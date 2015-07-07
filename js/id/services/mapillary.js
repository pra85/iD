iD.Mapillary  = function() {
    var dispatch = d3.dispatch('loadedImages', 'loadedSigns', 'loadedThumbnail'),
        endpoint = 'https://a.mapillary.com/v2/',
        clientId = 'NzNRM2otQkR2SHJzaXJmNmdQWVQ0dzoxNjQ3MDY4ZTUxY2QzNGI2',
        mapillary = {},
        images = clearCache(),
        signs = clearCache(),
        tileZoom = 17;

    function clearCache() {
        return {
            inflight: {},
            loaded: {}
        };
    }

    function abortRequest(i) {
        i.abort();
    }

    function getTiles(projection, dimensions) {
        var s = projection.scale() * 2 * Math.PI,
            z = Math.max(Math.log(s) / Math.log(2) - 8, 0),
            ts = 256 * Math.pow(2, z - tileZoom),
            origin = [
                s / 2 - projection.translate()[0],
                s / 2 - projection.translate()[1]];

        return d3.geo.tile()
            .scaleExtent([tileZoom, tileZoom])
            .scale(s)
            .size(dimensions)
            .translate(projection.translate())()
            .map(function(tile) {
                var x = tile[0] * ts - origin[0],
                    y = tile[1] * ts - origin[1];

                return {
                    id: tile.toString(),
                    extent: iD.geo.Extent(
                        projection.invert([x, y + ts]),
                        projection.invert([x + ts, y]))
                };
            });
    }


    function loadTiles(which, url, projection, dimensions) {
        var tiles = getTiles(projection, dimensions);

        _.filter(which.inflight, function(v, k) {
            var wanted = _.find(tiles, function(tile) { return k === tile.id; });
            if (!wanted) delete which.inflight[k];
            return !wanted;
        }).map(abortRequest);

        tiles.forEach(function(tile) {
            var id = tile.id,
                extent = tile.extent;

            if (which.loaded[id] || which.inflight[id]) return;

            which.inflight[id] = d3.json(url +
                iD.util.qsString({
                    geojson: 'true',
                    client_id: clientId,
                    min_lat: extent[0][1],
                    max_lat: extent[1][1],
                    min_lon: extent[0][0],
                    max_lon: extent[1][0]
                }), function(err, data) {
                    which.loaded[id] = true;
                    delete which.inflight[id];
                    if (err) return;

                    if (which === images)
                        dispatch.loadedImages(data);
                    else if (which === signs)
                        dispatch.loadedSigns(data);
                }
            );
        });
    }

    mapillary.loadImages = function(projection, dimensions) {
        var url = endpoint + 'search/s/geojson?';
        loadTiles(images, url, projection, dimensions);
    };

    mapillary.loadSigns = function(projection, dimensions) {
        var url = endpoint + 'search/im/geojson/or?';
        loadTiles(signs, url, projection, dimensions);
    };

    mapillary.flush = function() {
        _.forEach(images.inflight, abortRequest);
        _.forEach(signs.inflight, abortRequest);
        images = clearCache();
        signs = clearCache();
        return mapillary;
    };


    return d3.rebind(mapillary, dispatch, 'on');
};
