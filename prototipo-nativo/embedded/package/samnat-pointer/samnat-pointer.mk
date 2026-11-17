################################################################################
# SamNat pointer bridge
################################################################################

SAMNAT_POINTER_VERSION = 1.0
SAMNAT_POINTER_SITE = $(BR2_EXTERNAL_SAMNAT_PATH)/package/samnat-pointer/src
SAMNAT_POINTER_SITE_METHOD = local
SAMNAT_POINTER_DEPENDENCIES = libinput libudev
SAMNAT_POINTER_LICENSE = MIT

define SAMNAT_POINTER_BUILD_CMDS
	$(TARGET_CC) $(TARGET_CPPFLAGS) $(TARGET_CFLAGS) \
		$(@D)/samnat-pointer.c -o $(@D)/samnat-pointer \
		$(TARGET_LDFLAGS) -linput -ludev
endef

define SAMNAT_POINTER_INSTALL_TARGET_CMDS
	$(INSTALL) -D -m 0755 $(@D)/samnat-pointer $(TARGET_DIR)/usr/bin/samnat-pointer
endef

$(eval $(generic-package))
