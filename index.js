var self = require("sdk/self");
var urls = require("sdk/url");
var events = require("sdk/system/events");
var preferences = require("sdk/simple-prefs").prefs;
var sp = require("sdk/simple-prefs");
var Request = require("sdk/request").Request;

var { setInterval } = require("sdk/timers");
let { Bookmark, Group, search, save, remove, MENU } = require("sdk/places/bookmarks");

function getGroup(callback) {
    search({ type: "group", group: MENU, title: preferences.group }).on("end", function (results) {
        var group;
        console.log("found items: "+results.length);
        results.forEach(function (item) {
            if (item.type == "group" && item.title == preferences.group) {
                group = item;
                callback(group);
            }
        });

        if (!group) {
            console.log("creating new group: "+preferences.group);
            group = Group({ title: preferences.group, group: MENU });
            save(group).on("end", function () {
                callback(group);
            });
        }
    });
}

function whenReady(callback) {
    if (!preferences.url || preferences.url == "https://" || !urls.isValidURI(preferences.url)) {
        console.error("url is not valid: "+preferences.url)

        return;
    }

    if (!preferences.group) {
        console.error("no group configured");

        return;
    }

    var search = {
        url: preferences.url,
        onComplete: function onComplete(credentials) {
            if (credentials.length > 0) {
                getGroup(function (group) {
                    callback(credentials[0].username, credentials[0].password, group);
                });
            } else {
                console.error("no credentials found for "+preferences.url);
            }
        }
    };
    if (preferences.username) {
        search.username = preferences.username;
    }

    require("sdk/passwords").search(search);
}

function syncBookmarks(ownCloudBookmarks, group) {
    // Remove bookmarks
    search({ group: group }).on("end", function (results) {
        var oldBookmarks = results.filter(function (item) {
            return item.type == "bookmark" && item.group == group;
        });
        save(remove(oldBookmarks)).on("end", function () {
            // Add bookmarks
            let bookmarks = [];
            ownCloudBookmarks.forEach(function (ownCloudBookmark) {
                var tags = ownCloudBookmark.tags.filter(function (tag) {
                    return tag != "";
                });

                let bookmark = Bookmark({ title: ownCloudBookmark.title, url: ownCloudBookmark.url, tags: tags, group: group });

                bookmarks.push(bookmark);
            });

            save(bookmarks);
        });
    });
}

function getBookmarks(username, password, group) {
    var bookmarksRequest = Request({
        url: preferences.url + "/index.php/apps/bookmarks/public/rest/v1/bookmark?user=" + username + "&password=" + password + "&select[0]=tags&select[1]=description",
        onComplete: function (response) {
            console.log("fetched "+response.json.length+" bookmarks from "+preferences.url);
            syncBookmarks(response.json, group);
        }
    }).get();
}

function run() {
    whenReady(getBookmarks);
}

sp.on("sync", run);

run();
setInterval(run, preferences.interval * 1000 * 60);
