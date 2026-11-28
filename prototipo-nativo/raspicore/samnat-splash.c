#include <errno.h>
#include <fcntl.h>
#include <linux/fb.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>

static struct fb_var_screeninfo v;
static struct fb_fix_screeninfo f;
static unsigned char *screen;

static uint32_t component(unsigned value, struct fb_bitfield field) {
    if (!field.length) return 0;
    return (uint32_t)(((uint64_t)value * ((1ULL << field.length) - 1) / 255) << field.offset);
}
static void pixel(unsigned x, unsigned y, unsigned r, unsigned g, unsigned b) {
    if (x >= v.xres || y >= v.yres) return;
    unsigned bytes = (v.bits_per_pixel + 7) / 8;
    size_t offset = (size_t)(y + v.yoffset) * f.line_length + (size_t)(x + v.xoffset) * bytes;
    if (offset + bytes > f.smem_len) return;
    uint32_t c = component(r, v.red) | component(g, v.green) | component(b, v.blue);
    for (unsigned i = 0; i < bytes; i++) screen[offset + i] = c >> (i * 8);
}
int main(int argc, char **argv) {
    if (argc != 4) return 2;
    int progress = atoi(argv[3]);
    if (progress < 0) progress = 0;
    if (progress > 100) progress = 100;
    int fd = open(argv[1], O_RDWR);
    if (fd < 0 || ioctl(fd, FBIOGET_VSCREENINFO, &v) || ioctl(fd, FBIOGET_FSCREENINFO, &f)) return 1;
    if (v.bits_per_pixel != 16 && v.bits_per_pixel != 24 && v.bits_per_pixel != 32) return 1;
    screen = mmap(NULL, f.smem_len, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
    if (screen == MAP_FAILED) return 1;
    for (unsigned y = 0; y < v.yres; y++) for (unsigned x = 0; x < v.xres; x++) pixel(x,y,14,23,38);
    FILE *logo = fopen(argv[2], "rb");
    if (logo) {
        unsigned w, h, max;
        if (fscanf(logo, "P6 %u %u %u", &w, &h, &max) == 3 && max == 255 && w <= v.xres && h <= v.yres) {
            int separator = fgetc(logo);
            if (separator != EOF) {
                unsigned x0 = (v.xres - w) / 2, y0 = (v.yres - h) / 2;
                for (unsigned y = 0; y < h; y++) for (unsigned x = 0; x < w; x++) {
                    unsigned char rgb[3];
                    if (fread(rgb, 1, 3, logo) != 3) goto done_logo;
                    pixel(x0+x, y0+y, rgb[0], rgb[1], rgb[2]);
                }
            }
        }
done_logo:
        fclose(logo);
    }
    unsigned width = v.xres * 3 / 5, x0 = (v.xres - width) / 2, y0 = v.yres * 3 / 4;
    for (unsigned y = y0; y < y0 + 8 && y < v.yres; y++)
        for (unsigned x = 0; x < width; x++)
            if (x < width * (unsigned)progress / 100) pixel(x0+x,y,45,145,245);
            else pixel(x0+x,y,55,68,84);
    munmap(screen, f.smem_len);
    close(fd);
    return 0;
}
