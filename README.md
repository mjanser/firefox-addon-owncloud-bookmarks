# ownCloud Bookmarks
Add-on for syncing bookmarks with ownCloud.

For now the synchronization is only one-way, from ownCloud to Firefox.
This means all bookmarks in the configured folder will be overwritten with the ones from ownCloud.

This add-on won't work well if Firefox Sync is enabled, the browser will be unresponsive during the bookmark synchronization.

The password is retrieved from the password store. The easiest way to fill it is:

- Enable saving passwords in Firefox preferences
- Go to your ownCloud
- Log in with your user
- Save the password
