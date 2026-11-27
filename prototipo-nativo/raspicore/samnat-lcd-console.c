#include <errno.h>
#include <fcntl.h>
#include <linux/fb.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/ioctl.h>
#include <unistd.h>

/* Map the boot and kiosk virtual terminals to the detected LCD framebuffer. */
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  char *end;
  unsigned long number = strtoul(argv[1], &end, 10);
  if (!*argv[1] || *end || number > 31) return 2;
  char path[32];
  snprintf(path, sizeof(path), "/dev/fb%lu", number);
  int fd = open(path, O_RDWR);
  if (fd < 0) { perror(path); return 1; }
  for (unsigned int console = 1; console <= 2; console++) {
    struct fb_con2fbmap mapping = { .console = console, .framebuffer = (unsigned int)number };
    if (ioctl(fd, FBIOPUT_CON2FBMAP, &mapping) < 0) {
      perror("FBIOPUT_CON2FBMAP");
      close(fd);
      return 1;
    }
  }
  close(fd);
  printf("SamNat: consoles 1 e 2 mapeados para %s\n", path);
  return 0;
}
