var self = require("sdk/self");
var urls = require("sdk/url");
var events = require("sdk/system/events");
var preferences = require("sdk/simple-prefs").prefs;
var sp = require("sdk/simple-prefs");
var Request = require("sdk/request").Request;
const { defer, all } = require('sdk/core/promise');

var { setInterval, clearInterval } = require("sdk/timers");
let { Bookmark, Group, search, save, remove, MENU } = require("sdk/places/bookmarks");

var interval = null;
var intervalId = null;

function searchCredentials() {
    var deferred = defer();
    var search = {
        url: preferences.url,
        onComplete: function (credentials) {
            if (credentials.length > 0) {
                deferred.resolve(credentials[0]);
            } else {
                deferred.reject("no credentials found in password store for "+preferences.url);
            }
        },
        onError: function (error) {
            deferred.reject(error);
        }
    };
    if (preferences.username) {
        search.username = preferences.username;
    }

    require("sdk/passwords").search(search);

    return deferred.promise;
}

function getGroup() {
    var deferred = defer();
    search({ type: "group", group: MENU, title: preferences.group }).on("end", function (results) {
        var group;
        results.forEach(function (item) {
            if (item.type == "group" && item.title == preferences.group) {
                group = item;
                deferred.resolve(group);
            }
        });

        if (!group) {
            console.log("creating new bookmark group: "+preferences.group);
            group = Group({ title: preferences.group, group: MENU });
            save(group).on("end", function () {
                deferred.resolve(group);
            }).on("error", function (error) {
                deferred.reject(error);
            });
        }
    }).on("error", function (error) {
        deferred.reject(error);
    });

    return deferred.promise;
}

function getBookmarks(username, password) {
    var deferred = defer();
    var bookmarksRequest = Request({
        url: preferences.url + "/index.php/apps/bookmarks/public/rest/v1/bookmark?user=" + encodeURIComponent(username) + "&password=" + encodeURIComponent(password) + "&select[0]=tags&select[1]=description",
        onComplete: function (response) {
            if (200 == response.status) {
                console.log("fetched "+response.json.length+" bookmarks from "+preferences.url);
                deferred.resolve(response.json);
            } else {
                deferred.reject("fetching bookmarks from "+preferences.url+" returned status "+response.status);
            }
        }
    }).get();

    return deferred.promise;
}

function syncBookmarks(username, password, group) {
    getBookmarks(username, password).then(function (ownCloudBookmarks) {
        // Remove bookmarks
        search({ group: group }).on("end", function (results) {
            var oldBookmarks = results.filter(function (item) {
                return item.type == "bookmark" && item.group.id == group.id;
            });
            save(remove(oldBookmarks)).on("end", function () {
                // Add bookmarks
                let bookmarks = [];
                ownCloudBookmarks.forEach(function (ownCloudBookmark) {
                    var tags = ownCloudBookmark.tags.filter(function (tag) {
                        return tag != "";
                    });
                    var url = decodeURI(ownCloudBookmark.url);

                    let bookmark = Bookmark({
                        title: ownCloudBookmark.title || url,
                        url: url,
                        tags: tags,
                        group: group
                    });

                    bookmarks.push(bookmark);
                });

                save(bookmarks);
            });
        });
    });
}

function updateInterval() {
    if (interval != preferences.interval) {
        clearInterval(intervalId);
        interval = preferences.interval;
        intervalId = setInterval(run, interval * 1000 * 60);
    }
}

function run() {
    if (!preferences.url || preferences.url == "https://" || !urls.isValidURI(preferences.url)) {
        console.error("url is not valid: "+preferences.url)

        return;
    }

    if (!preferences.group) {
        console.error("no group configured");

        return;
    }

    try {
        all([searchCredentials(), getGroup()]).then(function (result) {
            syncBookmarks(result[0].username, result[0].password, result[1]);
            updateInterval();
        });
    } catch (e) {
        console.error(e);
        updateInterval();
    }
}

sp.on("sync", run);
updateInterval();
