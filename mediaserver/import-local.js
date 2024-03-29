// Default MediaTomb import script.
// see MediaTomb scripting documentation for more information

/*MT_F*
    
    MediaTomb - http://www.mediatomb.cc/
    
    import.js - this file is part of MediaTomb.
    
    Copyright (C) 2006-2010 Gena Batyan <bgeradz@mediatomb.cc>,
                            Sergey 'Jin' Bostandzhyan <jin@mediatomb.cc>,
                            Leonhard Wimmer <leo@mediatomb.cc>
    
    This file is free software; the copyright owners give unlimited permission
    to copy and/or redistribute it; with or without modifications, as long as
    this notice is preserved.
    
    This file is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
    
    $Id: import.js 2081 2010-03-23 20:18:00Z lww $
*/

// To lint: eslint --no-eslintrc import-local.js

function addAudio(obj)
{
 
    var desc = '';
    var artist_full;
    var album_full;
    
    // first gather data
    var title = obj.meta[M_TITLE];
    if (!title) title = obj.title;
    
    var artist = obj.meta[M_ARTIST];
    if (!artist) 
    {
        artist = 'Unknown';
        artist_full = null;
    }
    else
    {
        artist_full = artist;
        desc = artist;
    }
    
    var album = obj.meta[M_ALBUM];
    if (!album) 
    {
        album = 'Unknown';
        album_full = null;
    }
    else
    {
        desc = desc + ', ' + album;
        album_full = album;
    }
    
    if (desc)
        desc = desc + ', ';
    
    desc = desc + title;
    
    var date = obj.meta[M_DATE];
    if (!date)
    {
        date = 'Unknown';
    }
    else
    {
        date = getYear(date);
        desc = desc + ', ' + date;
    }
    
    var genre = obj.meta[M_GENRE];
    if (!genre)
    {
        genre = 'Unknown';
    }
    else
    {
        desc = desc + ', ' + genre;
    }
    
    var description = obj.meta[M_DESCRIPTION];
    if (!description) 
    {
        obj.meta[M_DESCRIPTION] = desc;
    }

// uncomment this if you want to have track numbers in front of the title
// in album view
    
/*    
    var track = obj.meta[M_TRACKNUMBER];
    if (!track)
        track = '';
    else
    {
        if (track.length == 1)
        {
            track = '0' + track;
        }
        track = track + ' ';
    }
*/
    // comment the following line out if you uncomment the stuff above  :)
    var track = '';

    var chain = new Array('Audio', 'All Audio');
    obj.title = title;
    addCdsObject(obj, createContainerChain(chain));
    
    chain = new Array('Audio', 'Artists', artist, 'All Songs');
    addCdsObject(obj, createContainerChain(chain));
    
    chain = new Array('Audio', 'All - full name');
    var temp = '';
    if (artist_full)
        temp = artist_full;
    
    if (album_full)
        temp = temp + ' - ' + album_full + ' - ';
    else
        temp = temp + ' - ';
   
    obj.title = temp + title;
    addCdsObject(obj, createContainerChain(chain));
    
    chain = new Array('Audio', 'Artists', artist, 'All - full name');
    addCdsObject(obj, createContainerChain(chain));
    
    chain = new Array('Audio', 'Artists', artist, album);
    obj.title = track + title;
    addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER_MUSIC_ALBUM);
    
    chain = new Array('Audio', 'Albums', album);
    obj.title = track + title; 
    addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER_MUSIC_ALBUM);
    
    chain = new Array('Audio', 'Genres', genre);
    addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER_MUSIC_GENRE);
    
    chain = new Array('Audio', 'Year', date);
    addCdsObject(obj, createContainerChain(chain));
}

function addVideoDefault(obj)
{
    var chain = new Array('Video', 'All Video');
    addCdsObject(obj, createContainerChain(chain));

    // For MediaTomb, change to object_root_path instead of object_script_path.
    var dir = getRootPath(object_script_path, obj.location);

    if (dir.length > 0)
    {
        chain = new Array('Video', 'Directories');
        chain = chain.concat(dir);

        addCdsObject(obj, createContainerChain(chain));
    }
}

function addVideo(obj)
{
    // Special treatment for Azureus-managed download folders.
    if (obj.location.indexOf('/bttmp/') != -1) {
        // Ignore incomplete Vuze downloads.
        return;
    }
    else if (obj.location.startsWith('/srv/media') || obj.location.startsWith('/afs/')) {
        var folder = obj.location.split('/');
        print("Folder: " + folder.toString());
        folder.shift();  // '^'
        folder.shift();  // 'srv' / 'afs'
        folder.shift();  // 'media' / 'root.cell'
        folder.shift();  // NFS export / 'pub'

        var chain = new Array('Video');
        if (folder[0] == 'btdone') {
            chain = chain.concat('Torrents');
            folder.shift();  // 'btdone'
        } else if (obj.location.startsWith('/afs/')) {
            chain = chain.concat('AFS');
        } else {
            chain = chain.concat('Media Server');
        }
        print("Folder after: " + folder.toString());

        // Clean up UPnP folder tree.
        for (var i = 0; i < folder.length; i++) {
            // Squash nuisance bracketed prefixes.
            folder[i] = folder[i].replace(/^\[[^\]]*\][^A-Za-z0-9]*/, '');
            // Squash leading whitespace.
            folder[i] = folder[i].replace(/^\s*/, '');
            // Uppercase first letter to produce a single alphabetical container ordering.
            folder[i] = folder[i].replace(/^\w/, function (c) { return c.toUpperCase(); });
        }
        // Squash nuisance bracketed prefixes in title.
        oldTitle = obj.title;
        obj.title = obj.title.replace(/^\[[^\]]*\][^A-Za-z0-9]*/, '');
        // Unless only the extension would remain.
        if (obj.title.match('^\.[^\.]*$')) {
            obj.title = oldTitle;
        }
        // Remove suffix.
        obj.title = obj.title.replace(/\.[^\.]*$/, '');

        folder.pop();  // Remove the trailing filename since we're not using it as the title.
        print('Adding in ' + folder.toString() + ' as ' + obj.title);
        addCdsObject(obj, createContainerChain(chain.concat(folder)));
        // Add companion resume objects in an alternate-path container named after the target object.
        folder.unshift('000.Resume.000');
        title = obj.title;
        for (i = 1; i < 5; i++) {
            obj.title = (i * 20) + '% - ' + title;
            print('Adding ' + obj.location + ' with title ' + title + ' as ' + obj.title);
            addCdsObject(obj, createContainerChain(chain.concat(folder).concat(title)));
        }
    }
    // Everything else.
    else {
        addVideoDefault(obj);
    }
}

function addWeborama(obj)
{
    var req_name = obj.aux[WEBORAMA_AUXDATA_REQUEST_NAME];
    if (req_name)
    {
        var chain = new Array('Online Services', 'Weborama', req_name);
        addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_PLAYLIST_CONTAINER);
    }
}

function addImage(obj)
{
    var chain = new Array('Photos', 'All Photos');
    addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER);

    var date = obj.meta[M_DATE];
    if (date)
    {
        var dateParts = date.split('-');
        if (dateParts.length > 1)
        {
            var year = dateParts[0];
            var month = dateParts[1];

            chain = new Array('Photos', 'Year', year, month);
            addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER);
        }

        chain = new Array('Photos', 'Date', date);
        addCdsObject(obj, createContainerChain(chain), UPNP_CLASS_CONTAINER);
    }

    // For MediaTomb, change to object_root_path instead of object_script_path.
    var dir = getRootPath(object_script_path, obj.location);

    if (dir.length > 0)
    {
        chain = new Array('Photos', 'Directories');
        chain = chain.concat(dir);

        addCdsObject(obj, createContainerChain(chain));
    }
}


function addYouTube(obj)
{
    var chain;

    var temp = parseInt(obj.aux[YOUTUBE_AUXDATA_AVG_RATING], 10);
    if (temp != Number.NaN)
    {
        temp = Math.round(temp);
        if (temp > 3)
        {
            chain = new Array('Online Services', 'YouTube', 'Rating', 
                                  temp.toString());
            addCdsObject(obj, createContainerChain(chain));
        }
    }

    temp = obj.aux[YOUTUBE_AUXDATA_REQUEST];
    if (temp)
    {
        var subName = (obj.aux[YOUTUBE_AUXDATA_SUBREQUEST_NAME]);
        var feedName = (obj.aux[YOUTUBE_AUXDATA_FEED]);
        var region = (obj.aux[YOUTUBE_AUXDATA_REGION]);

            
        chain = new Array('Online Services', 'YouTube', temp);

        if (subName)
            chain.push(subName);

        if (feedName)
            chain.push(feedName);

        if (region)
            chain.push(region);

        addCdsObject(obj, createContainerChain(chain));
    }
}

function addTrailer(obj)
{
    var chain;

    chain = new Array('Online Services', 'Apple Trailers', 'All Trailers');
    addCdsObject(obj, createContainerChain(chain));

    var genre = obj.meta[M_GENRE];
    if (genre)
    {
        genres = genre.split(', ');
        for (var i = 0; i < genres.length; i++)
        {
            chain = new Array('Online Services', 'Apple Trailers', 'Genres',
                              genres[i]);
            addCdsObject(obj, createContainerChain(chain));
        }
    }

    var reldate = obj.meta[M_DATE];
    if ((reldate) && (reldate.length >= 7))
    {
        chain = new Array('Online Services', 'Apple Trailers', 'Release Date',
                          reldate.slice(0, 7));
        addCdsObject(obj, createContainerChain(chain));
    }

    var postdate = obj.aux[APPLE_TRAILERS_AUXDATA_POST_DATE];
    if ((postdate) && (postdate.length >= 7))
    {
        chain = new Array('Online Services', 'Apple Trailers', 'Post Date',
                          postdate.slice(0, 7));
        addCdsObject(obj, createContainerChain(chain));
    }
}

// main script part

if (getPlaylistType(orig.mimetype) == '')
{
    var arr = orig.mimetype.split('/');
    var mime = arr[0];
    
    // var obj = copyObject(orig);
    
    var obj = orig; 
    obj.refID = orig.id;
    
    if (mime == 'audio')
    {
        addAudio(obj);
    }
    
    if (mime == 'video')
    {
        if (obj.onlineservice == ONLINE_SERVICE_YOUTUBE)
            addYouTube(obj);
        else if (obj.onlineservice == ONLINE_SERVICE_APPLE_TRAILERS)
            addTrailer(obj);
        else
            addVideo(obj);
    }
    
    if (mime == 'image')
    {
        addImage(obj);
    }

    if (orig.mimetype == 'application/ogg')
    {
        if (orig.theora == 1)
            addVideo(obj);
        else
            addAudio(obj);
    }
}

// vim: sw=4:ts=4:et
