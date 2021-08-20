/**
 * Created by e524935 on 3/3/15.
 */

'use strict';

window.BubbleCloud = function (config) {

    var chart, collide, connectEvents, force, gravity, transformData;

    var nodes = null;
    var labels = null;

    var tick, dragTick, positionRegions;

    var dblclick, dragstart, drag, draging, dragend, mouseover, mouseout; // event handlers

    var update, updateActive, updateLabels, updateNodes, updateSelections;

    var rawNodes = [];   // the original/complete copy of data
    var data = [];          // the current copy of data used to plot the chart
    var selectedNodes = [];  // selected data

    var collideV2;
    var dragSourceNode, dropTargetNode;
    var isMergePending = false;
    var isMergeDone = false;
    var isActiveDragEvent = false;
    var mergeNodes, demergeNodes, showSubRegions, hideSubRegions, toggleRegions;
    var mergeMap = [];      //
    var prevNodeLoc = {id: null, x: null, y: null};   // previous location of the dragged node

    var CONST_COMMA = ',', CONST_SPACE = ' ', CONST_PLUS = '(+)', CONST_MINUS = '(-)',
        CONST_REGION = 'region';

    var margin = {
        top: 5,
        right: 0,
        bottom: 0,
        left: 0
    };

    var model = {
        width: 978,
        height: 520,
        maxRadius: 40,
        minRadius: 15,
        collisionPadding: 15,
        enableDrag: true,
        enableClick: true
    };

    var width;
    var height;
    var maxRadius; // 65
    var minRadius;
    var collisionPadding;//4;

    var minCollisionRadius = 12;
    var jitter = 0.5;

    var LINE_BR = ' or ';//'&#013;';

    //rScale = d3.scale.sqrt().range([0, maxRadius]);
    var rScale;

    var init = function (config) {
        $.extend(true, model, config);
        width = model.width;
        height = model.height;
        maxRadius = model.maxRadius;
        minRadius = model.minRadius;
        collisionPadding = model.collisionPadding;

        rScale = d3.scale.sqrt().range([minRadius, maxRadius]);
        // init the layout force
        force = d3.layout.force().gravity(0).charge(0).size([width, height]).on('tick', tick);
        // register drag related events

        if (!!model.enableDrag) {
            drag = force.drag().on('dragstart', dragstart).on('drag', draging).on('dragend', dragend);
        } else {
            drag = force.drag().on('dragstart', null).on('drag', null).on('dragend', null);
        }
    };

    var rValue = function (d) {
        //if (d.isSatelliteNode) {
        //    return d.onlyToCalRadius;
        //}

        return d.count;
    };

    // get parent ID of current tag
    var parentIdValue = function (d) {
        return (!!d.parentId) ? (d.type + '-' + d.parentId) : '';
    };
    // get original member node IDs of the merged node
    var memberIds = function (d) {
        return (!!d.isMergedNode) ? d.memberIds.join('&') : '';
    };

    var _log = function (message) {
        var turnOnLog;
        switch (window.location.hostname) {
            case 'localhost':
            case '127.0.0.1':
                turnOnLog = true;
                break;
            default:
                turnOnLog = false;
        }
        if (turnOnLog) {
            console.log(message);
        }
    };
    /**
     * transform the raw data
     * @param rawData
     * @returns {*}
     */
    transformData = function (rawData) {

        rawData.forEach(function (d) {
            d.count = parseInt(d.nbArticles);
            d.title = d.tagName;    // tooltip
            if (d.tagType === CONST_REGION) {
                d.name = d.tagName + CONST_SPACE + CONST_PLUS;     // display name
            } else {
                d.name = d.tagName;     // display name
            }

            d.value = d.tagName;    // real value
            d.type = d.tagType;
            d.id = d.type + '-' + d.tagId;
            d.selected = false;

            //return rawData.sort(function () {
            //    return 0.5 - Math.random();
            //});
        });

        // save the raw data for future reference
        rawNodes = [].concat(rawData);

        //_log('rawNodes.length: ' + rawNodes.length);

        return rawData;
    };


    /**
     * the default force layout simulation one step
     */
    tick = function (e) {
        var dampenedAlpha;
        dampenedAlpha = e.alpha * 0.1;
        nodes.each(gravity(dampenedAlpha)).each(collide(jitter)).attr('transform', function (d) {
            return 'translate(' + d.x + CONST_COMMA + d.y + ')';
        });
        return labels.style('left', function (d) {
            return ((margin.left + d.x) - d.dx / 2) + 'px';
        }).style('top', function (d) {
            return ((margin.top + d.y) - d.dy / 2) + 'px';
        });
    };


    /**
     * the dragging force layout simulation one step
     *
     */
    dragTick = function () {
        // reposition the node/circle
        nodes.attr('transform', function (d) {
            return 'translate(' + d.x + CONST_COMMA + d.y + ')';
        });

        nodes.each(collideV2(jitter));
        return labels.style('left', function (d) {
            return ((margin.left + d.x) - d.dx / 2) + 'px';
        }).style('top', function (d) {
            return ((margin.top + d.y) - d.dy / 2) + 'px';
        });
    };

    positionRegions = function () {
        // reposition the node/circle
        nodes.attr('transform', function (d) {
            return 'translate(' + d.x + CONST_COMMA + d.y + ')';
        });
        return labels.style('left', function (d) {
            return ((margin.left + d.x) - d.dx / 2) + 'px';
        }).style('top', function (d) {
            return ((margin.top + d.y) - d.dy / 2) + 'px';
        });
    };

    chart = function (selection) {
        return selection.each(function (rawData) {
            var maxDomainValue, svg, svgEnter;
            data = transformData(rawData);

            maxDomainValue = d3.max(data, function (d) {
                return rValue(d);
            });

            rScale.domain([0, maxDomainValue]);
            svg = d3.select(this).selectAll('svg').data([data]);

            svgEnter = svg.enter().append('svg');
            svgEnter.attr('width', width + margin.left + margin.right);
            svgEnter.attr('height', height + margin.top + margin.bottom);

            var nodesG = svgEnter.append('g').attr('id', 'bubble-nodes').attr('transform', 'translate(' + margin.left + CONST_COMMA + margin.top + ')');
            nodesG.append('rect').attr('id', 'bubble-background').attr('width', width).attr('height', height);

            var labelsG = d3.select(this).append('div').attr('id', 'bubble-labels');

            nodes = nodesG.selectAll('.bubble-node');
            labels = labelsG.selectAll('.bubble-label');

            update();
        });
    };

    /**
     * re-render the bubble cloud
     */
    update = function () {

        data.forEach(function (d) {
            d.forceR = Math.max(minCollisionRadius, rScale(rValue(d)));
        });

        force.nodes(data);

        updateNodes();
        updateLabels();

        updateSelections();

        force.start();
    };

    updateNodes = function () {
        nodes = nodes.data(data, function (d) {
            return d.id;
        });

        var nodeEnter = nodes.enter().append('a').classed({
            'bubble-node': true,
            'parent-node': function (d) {
                return !parentIdValue(d);
            },
            'merged-node': function (d) {
                return d.isMergedNode;
            },
            'assetclass': function (d) {
                return d.type.toLowerCase() === 'assetclass';
            },
            'region': function (d) {
                return d.type.toLowerCase() === CONST_REGION;
            },
            'popularword': function (d) {
                return d.type.toLowerCase() === 'popularword';
            },
            'topic': function (d) {
                return d.type.toLowerCase() === 'topic';
            },
            'bubble-selected': function (d) {
                return !!d.selected;
            }
        }).attr('id', function (d) {
            return d.id;
        }).attr('parent-id', function (d) {
            return parentIdValue(d);
        }).attr('member-ids', function (d) {
            return memberIds(d);
        }).attr('title', function (d) {
            return d.title;
        }).call(force.drag).call(connectEvents);

        nodeEnter.append('circle')
            .attr('class', 'node')
            .attr('r', function (d) {
                return rScale(rValue(d));
            });

        nodes.exit().remove();
    };

    updateLabels = function () {

        function _getWordsArr(str, separator) {
            return str.split(separator);
        }

        function _getSeparator(d) {
            var separator = CONST_SPACE;
            if (!!d.isMergedNode && d.name.indexOf(CONST_COMMA) !== -1) {
                separator = CONST_COMMA;
            }
            return separator;
        }

        labels = labels.data(data, function (d) {
            return d.id;
        });

        var labelEnter = labels.enter().append('a').classed({
            'bubble-label': true, 'parent-node': function (d) {
                return !parentIdValue(d);
            }
        }).attr('bubble-label-id', function (d) {
            return d.id;
        }).attr('parent-id', function (d) {
            return parentIdValue(d);
        }).attr('title', function (d) {
            return d.title;
        });

        labels.style('font-size', function (d) {
            //TODO: decrease the font size if it's a merged node
            var fsize = Math.max(8, rScale(rValue(d) / 6) / 1.5);
            if (!!d.isMergedNode) {
                fsize = Math.max(8, fsize / 1.2);
            }
            return fsize + 'px';
        });

        labelEnter.append('div').attr('class', 'bubble-label-name').html(function (d) {
            var separator, wordNumEveryLine, words;

            function _breedWordsToDisplay(words, wordNumEveryLine, separator) {
                var connectSymbol, resultText = '', wordNum;
                wordNum = words.length;
                for (var i = 0; i < wordNum; i++) {

                    if ((i + 1) % wordNumEveryLine === 0) {
                        connectSymbol = '<br>' + separator;
                    } else {
                        connectSymbol = separator;
                    }
                    if (i === wordNum - 1) {
                        resultText += words[i];
                    } else {
                        resultText += words[i] + connectSymbol;
                    }
                }

                if (separator === CONST_COMMA) {
                    resultText = resultText.replace(/\,\(\+\)/, CONST_SPACE + CONST_PLUS);
                }

                return resultText;
            }

            function _calWordNumEveryLine(words) {
                var wordNum = words.length;
                var wordNumEveryLine;

                if (wordNum >= 1 && wordNum <= 3) {
                    wordNumEveryLine = 1;
                } else {
                    wordNumEveryLine = 2;
                }

                return wordNumEveryLine;
            }

            separator = _getSeparator(d);
            words = _getWordsArr(d.name, separator);
            wordNumEveryLine = _calWordNumEveryLine(words);

            return _breedWordsToDisplay(words, wordNumEveryLine, separator);
        });
        labelEnter.append('div').attr('class', 'bubble-label-value').text(function (d) {
            return d.count;
        });

        labels.each(function (d) {
            d.dx = this.getBoundingClientRect().width;
            d.dy = this.getBoundingClientRect().height;
        });

        labels.style('width', function (d) {
            return d.dx + 'px';
        });

        labels.call(connectEvents).call(drag);

        labels.exit().remove();
    };


    mergeNodes = function (source, target) {
        if (source.isSatelliteNode || target.isSatelliteNode) {
            return;
        }
        function addIdsToRemove(object, node, idsToRemove) {
            (!!node.isMergedNode) ? (idsToRemove = idsToRemove.concat(node.memberIds)) : idsToRemove.push(object.id);
        }

        function _trimText(text) {
            var t = text.trim();

            if (t.length >= 20) {
                t = t.substr(0, 20) + '...';
            }

            _log('t: ' + t);

            return t;
        }

        // Step 1: offload merged nodes from $data and put them aside
        var idsToRemove = [];

        //var realSourceId = realIdValue(source);
        //var realSourceId = source.id;
        var sourceIndex = _findIndex(data, source.id);
        var sourceNode = data.splice(sourceIndex, 1)[0];
        addIdsToRemove(source, sourceNode, idsToRemove);

        //var realTargetId = realIdValue(target);
        //var realTargetId = target.id;
        var targetIndex = _findIndex(data, target.id);
        var targetNode = data.splice(targetIndex, 1)[0];
        addIdsToRemove(target, targetNode, idsToRemove);

        // Step 2: construct a new node and push to $data.
        var nodeToAdd = {
            isMergedNode: true,
            // sum up all nodes
            count: source.count + target.count,
            //parentId: '',
            // reuse target node ID unless target node is a regular node
            // $mid is the key of each entry in $mergeMap
            mid: (!!target.isMergedNode ? target.id : (!!source.isMergedNode ? source.id : 'm' + new Date().getTime())),
            // tagId has to be unique so we concatenate source.tagId to target.tagId
            // otherwise, any change to the node value can not be reflected in the chart when we call update()
            //tagId: target.tagId + '-' + source.tagId,
            id: target.id + '_' + source.id,
            memberIds: (source.memberIds || [source.id]).concat((target.memberIds || [target.id])),
            // display name
            //name: '+',
            //name: target.name + ' +',
            type: target.type,
            // the merged node gets selected if either source or target node was selected
            selected: (!!target.selected || !!source.selected),
            // re-use the position of target node
            x: target.x,
            y: target.y
            //dx: Math.max(target.dx, source.dx),
            //dy: target.dy
            //remove set dx and dy, since after merge, the label width and height will re calculate in updateLabels
        };

        // set merged text
        var memberIds = nodeToAdd.memberIds;
        var names = [];
        for (var i = 0, length = memberIds.length; i < length; i++) {

            var j = _findIndex(rawNodes, memberIds[i]);

            if (j >= 0) {
                names.unshift(rawNodes[j].value);
            }
        }

        nodeToAdd.title = names.join(LINE_BR);
        nodeToAdd.value = names.join('|');
        nodeToAdd.name = _trimText(names.join(CONST_COMMA)) + CONST_COMMA + CONST_PLUS;

        data.push(nodeToAdd);

        // update the selected node list
        if (!!source.selected) {
            _removeById(selectedNodes, source.id);
        }
        if (!!target.selected) {
            _removeById(selectedNodes, target.id);
        }
        if (!!nodeToAdd.selected) {
            source.selected = target.selected = true;
            selectedNodes.push(nodeToAdd);
        }

        // Step 3: update the $mergeMap
        // check if $nodeToAdd is a new merged node
        var mIndex = _findIndex(mergeMap, nodeToAdd.mid);
        if (mIndex < 0) {
            mergeMap.push({
                id: nodeToAdd.mid,
                memberIds: idsToRemove
            });
        }
        else {
            mergeMap[mIndex].memberIds = idsToRemove;
        }

        // Step 4: update/redraw the chart
        update();

        isActiveDragEvent = false;
        isMergeDone = true;
        isMergePending = false;

        dragSourceNode = null;

        //_log('merge completed !!!');
    };

    function _findIndex(arr, id) {

        var index = -1;

        if (!!arr && arr.length > 0) {

            for (var i = 0, length = arr.length; i < length; i++) {
                if (arr[i].id === id) {
                    index = i;
                }
            }
        }

        return index;
    }

    function _removeById(arr, id) {
        var index = _findIndex(arr, id);
        arr.splice(index, 1);
    }


    /**
     * demerge the selected node and split into individual nodes
     * @param d - selected merged node
     */
    demergeNodes = function (d) {

        //_log('rawNodes.length: ' + rawNodes.length);

        // Step 1: remove the merged node
        //var dIndex = _findIndex(data, realIdValue(d));
        //data.splice(dIndex, 1);
        _removeById(data, d.id);

        // Step 2: update the entry from $mergeMap
        //var mIndex = _findIndex(mergeMap, d.mid);
        //mergeMap.splice(mIndex, 1);
        _removeById(mergeMap, d.mid);

        // Step 3: add back all member nodes of $d
        //var nodesToAdd = [];
        var memberIds = d.memberIds;
        for (var i = 0, length = memberIds.length; i < length; i++) {

            var j = _findIndex(rawNodes, memberIds[i]);

            var node = $.extend({}, rawNodes[j]);
            // by default, demerging a node should deselect all its member nodes
            node.selected = false;

            data.push(node);
            //if (!!d.selected) {
            //    // inherit .selected property from merged node
            //    node.selected = true;
            //    selectedNodes.push(node);
            //}
        }

        // Step 4: deselect the merged node if it was selected
        ////if (!!d.selected) {
        d.selected = false;
        _removeById(selectedNodes, d.id);
        //}

        _log('selectedNodes.length: ' + selectedNodes.length);

        // Step 5: update/redraw the chart
        update();
    };

    toggleRegions = function (node) {
        var refs = node.refs;
        if (!!refs && refs.length !== 0) {
            if (node.isShowAll) {
                hideSubRegions(node);
            } else {
                showSubRegions(node);
            }
        }
    };


    showSubRegions = function (node) {
        _log('show regions');
        var region, index, nodeToAdd, point, angle = 0, mockCentralNode, rSmall,
            //countForSatellite,
            anglePadding = 4, rTraceCircle, centreAngle, maxArticles,
            refs = node.refs;

        //countForSatellite = 100;

        node.isShowAll = true;
        node.name = node.name.replace(/\(\+\)/, CONST_MINUS);

        d3.select(model.placeholder + ' [bubble-label-id="' + node.id + '"] > div:first-child').text(function () {
            return node.name;
        });

        // lock all the other nodes by disabling drag behavior temporarily
        nodes.on('mousedown.drag', null).classed('fixed', true);
        force.drag().on('dragstart', null).on('drag', null).on('dragend', null);

        //hide all other bubble temporarily
        nodes.classed('bubble-hide', function (d) {
            return d !== node;
        });
        labels.classed('bubble-hide', function (d) {
            return d !== node;
        });

        force.on('tick', null);
        mockCentralNode = {};
        $.extend(true, mockCentralNode, node);
        mockCentralNode.id = node.id + '_' + 'mock';
        mockCentralNode.x = width / 2;
        mockCentralNode.y = height / 2;
        mockCentralNode.selected = false;

        //data.push(mockCentralNode);

        maxArticles = _findMaxArticles(refs);
        rSmall = rScale(maxArticles);

        rTraceCircle = _getRTraceCircle(rSmall, node.forceR);

        centreAngle = _getCentreAngle(rSmall, rTraceCircle);

        for (index = 0; index < refs.length; index++) {
            region = refs[index];
            region.id = node.id + '_' + index;

            anglePadding = centreAngle / 10;
            angle = angle + (centreAngle + anglePadding);

            if (angle >= 360) {
                angle = 0;
                rTraceCircle = rTraceCircle + 2 * rSmall + 10;
                centreAngle = _getCentreAngle(rSmall, rTraceCircle);
                anglePadding = centreAngle / 10;
                angle = angle + (centreAngle + anglePadding);
            }

            point = _getPoint(rTraceCircle, angle);

            nodeToAdd = {
                title: region.tagName,
                value: region.tagName,
                name: region.tagName,
                angle: angle,
                isSatelliteNode: true,
                // sum up all nodes
                count: parseInt(region.nbArticles),
                //onlyToCalRadius: countForSatellite,
                id: region.id,
                // display name
                type: CONST_REGION,
                subType: 'country',
                // the merged node gets selected if either source or target node was selected
                selected: region.selected,
                // re-use the position of target node
                x: node.x - point.x,
                y: node.y - point.y,
                dx: mockCentralNode.dx,
                dy: mockCentralNode.dy
            };

            data.push(nodeToAdd);
        }

        update();
        positionRegions();
        d3.select('#' + mockCentralNode.id).on('click', null);
        d3.select('[bubble-label-id="' + mockCentralNode.id + '"]').on('click', null);
        nodes.classed('fixed', false);
        force.drag().on('dragstart', dragstart).on('drag', draging).on('dragend', dragend);
        force.on('tick', tick);
    };

    hideSubRegions = function (node) {
        _log('hide regions');
        var index, region, actualRegionParentIndex, refs = node.refs;

        actualRegionParentIndex = _findIndex(data, node.id.split('_')[0]);
        node = data[actualRegionParentIndex];

        node.isShowAll = false;
        node.name = node.name.replace(/\(\-\)/, CONST_PLUS);
        d3.select(model.placeholder + ' [bubble-label-id="' + node.id + '"] > div:first-child').text(function () {
            return node.name;
        });

        for (index = 0; index < refs.length; index++) {
            region = refs[index];
            _removeById(data, node.id + '_' + index);
        }
        //_removeById(data, node.id + '_' + 'mock');

        nodes.classed('bubble-hide', false);
        labels.classed('bubble-hide', false);
        nodes.classed('fixed', false);
        force.drag().on('dragstart', dragstart).on('drag', draging).on('dragend', dragend);
        force.on('tick', tick);

        //remember the selected child region
        node.refs.forEach(function (d) {
            //reset all node selected to false
            d.selected = false;
            selectedNodes.forEach(function (d2) {
                if (!d2.isSatelliteNode) {
                    return;
                }
                //set selected node
                if (d.id === d2.id) {
                    d.selected = d2.selected;
                }
            });
        });

        update();

    };

    function _findMaxArticles(arr){
        var max = 0, articleNum;
        for(var i =0 ; i < arr.length; i++){
            articleNum = parseInt(arr[i].nbArticles);
            if(max < articleNum){
                max = articleNum;
            }
        }
        return max;
    }

    function _getPoint(r, angle) {
        var RAD = Math.PI / 180;
        var rst = {};
        rst.x = r * Math.cos(angle * RAD);
        rst.y = r * Math.sin(angle * RAD);
        return rst;
    }

    /**
     * Get angle at the centre.
     *
     * @param rSmall
     * the radius of small circle
     * @param rTraceCircle
     * rSmall + rLarge + padding
     * @returns {number}
     * @private
     */
    function _getCentreAngle(rSmall, rTraceCircle) {
        /**
         * Get distance from the chord to the centre
         *
         * rTraceCircle is the radius of small circle plus the radius of large circle and plus the padding
         *
         * a + b = rTraceCircle;
         *
         * a*a + x*x = rTraceCircle*rTraceCircle;
         *
         * b*b + x*x = rSmall*rSmall;
         *
         * x is chord length, a is distance from the chord to the centre of actual circle,
         * b is distance from the chord to the centre of small circle
         *
         * @param rSmall
         * the radius of small circle
         * @param rTraceCircle
         * rSmall + rLarge + padding
         * @returns {number}
         * distance from the chord to the centre
         * @private
         */
        function _getDistanceChordToCentre(rSmall, rTraceCircle) {
            return rTraceCircle - Math.pow(rSmall, 2) / (2 * rTraceCircle);
        }

        var distanceChordToCentre;

        distanceChordToCentre = _getDistanceChordToCentre(rSmall, rTraceCircle);
        return Math.acos(distanceChordToCentre / rTraceCircle) * 180 / Math.PI * 2;
    }

    function _getRTraceCircle(rSmall, rLarge) {
        var padding = 10;
        return rSmall + rLarge + padding;
    }

    gravity = function (alpha) {
        var ax, ay, cx, cy;
        cx = width / 2;
        cy = height / 2;
        ax = alpha / 8;
        ay = alpha;
        return function (d) {
            d.x += (cx - d.x) * ax;
            return d.y += (cy - d.y) * ay;
        };
    };
    collide = function (jitter) {
        return function (d) {
            return data.forEach(function (d2) {
                var distance, minDistance, moveX, moveY, x, y;
                if (d !== d2) {
                    x = d.x - d2.x;
                    y = d.y - d2.y;
                    distance = Math.sqrt(x * x + y * y);
                    minDistance = d.forceR + d2.forceR + collisionPadding;
                    if (distance < minDistance) {
                        distance = (distance - minDistance) / distance * jitter;
                        moveX = x * distance;
                        moveY = y * distance;
                        d.x -= moveX;
                        d.y -= moveY;
                        d2.x += moveX;
                        return d2.y += moveY;
                    }
                }
            });
        };
    };

    /**
     * detect collision
     */
    collideV2 = function () {

        //_log('entering collideV2');

        return function (d) {

            return data.forEach(function (d2) {
                    var distance, minDistance, x, y, minDistanceJoin;

                    if (d !== d2) {
                        x = d.x - d2.x;
                        y = d.y - d2.y;
                        distance = Math.sqrt(x * x + y * y);
                        minDistance = d.forceR + d2.forceR + collisionPadding;

                        if (distance < minDistance) {

                            if (isActiveDragEvent && !isMergeDone) {
                                minDistanceJoin = Math.max(d.forceR, d2.forceR) + collisionPadding;

                                //_log('dragging: ' + dragSourceNode.tagName);

                                var dragNodeId = dragSourceNode.id;

                                if ((d.id === dragNodeId || d2.id === dragNodeId) && (distance <= minDistanceJoin)) {

                                    if (d.type === d2.type) {

                                        dropTargetNode = (d.id === dragNodeId) ? d2 : d;

                                        isMergePending = true;

                                        //_log('about to merge $' + dragSourceNode.tagName + '$ into $' + dropTargetNode.tagName + '$');
                                        //return mergeNodes(dragSourceNode, dropTargetNode);
                                    }
                                }
                            }
                        }
                    }
                }
            );
        };
    };

    connectEvents = function (d) {

        if (model.enableClick) {
            d.on('click', chart.click);
            d.on('dblclick', dblclick);
            d.on('mouseover', mouseover);
            d.on('mouseout', mouseout);
        } else {
            d.on('click', function () {
                _log('enter empty click');
                if (!d3.event) {
                    return;
                }
                return d3.event.preventDefault();
            });
            d.on('dblclick', function () {
                _log('enter empty db-click');
                if (!d3.event) {
                    return;
                }
                return d3.event.preventDefault();
            });
            d.on('mouseover', null);
            d.on('mouseout', null);
        }
        return d;
    };

    /**
     *
     * @param d
     * @returns {*}
     */
    chart.click = function (d) {
        _log('click');

        var index = _findIndex(selectedNodes, d.id);

        if (index < 0) {
            // add to $selectedNodes
            d.selected = true;
            selectedNodes.push(d);
        }
        else {
            // remove from $selectedNodes
            d.selected = false;
            selectedNodes.splice(index, 1);
        }

        //_log('d.selected: ' + d.selected);
        //_log('selectedNodes.length: ' + selectedNodes.length);

        updateActive(d.id, d.selected);

        if (!d3.event) {
            return;
        }
        return d3.event.preventDefault();
    };


    /**
     * double click to make all the other nodes fixed by unbind the drag event
     * @param d
     */
    dblclick = function (d) {

        _log('double click');

        toggleRegions(d);

        d.selected = !d.selected;

        if (!!d.isMergedNode) {
            demergeNodes(d);
        }
    };

    dragstart = function (d) {

        //_log('drag start...');
        isActiveDragEvent = true;
        isMergeDone = false;
        isMergePending = false;

        dragSourceNode = d;

        // cache the previous location of the dragged node $d
        prevNodeLoc.id = d.id;
        prevNodeLoc.x = d.x;
        prevNodeLoc.y = d.y;
        prevNodeLoc.dx = d.dx;
        prevNodeLoc.dy = d.dy;

        //_log('save current position [x: ' + prevNodeLoc.x + ', y: ' + prevNodeLoc.y);
        //_log('set dragSourceNode to ' + dragSourceNode.tagName);

        // lock all the other nodes by disabling drag behavior temporarily
        //nodes.on('mousedown.drag', null).classed('fixed', d.fixed = true);
        nodes.on('mousedown.drag', null).classed('fixed', true);
        //
        d3.select(this).call(drag);

        // set to dragTick
        force.on('tick', null).on('tick', dragTick);
    };

    draging = function () {
        // get the being-dragged node ID
        var nodeId = d3.select(this).attr('bubble-label-id') || d3.select(this.parentNode).attr('id');

        // sync the label position
        d3.select(model.placeholder + ' [bubble-label-id=' + nodeId + ']').style('left', function (d) {
            return ((margin.left + d.x) - d.dx / 2) + 'px';
        }).style('top', function (d) {
            return ((margin.top + d.y) - d.dy / 2) + 'px';
        });
    };

    dragend = function () {

        // unlock all nodes
        //nodes.call(drag).classed('fixed', d.fixed = false);
        nodes.call(drag).classed('fixed', false);

        // lock $dropTargetNode
        if (!!dropTargetNode) {
            //nodes.select('#' + idValue(dropTargetNode)).classed('fixed', dropTargetNode.fixed = true);
            nodes.select('#' + dropTargetNode.id).classed('fixed', true);
        }

        //dragSourceNode = null;

        force.on('tick', null);


        if (!!isMergePending) {


            mergeNodes(dragSourceNode, dropTargetNode);

            // TODO: re-position the dragged node to its previous [dx, dy] if no merge happened

            // starts a transition
            d3.select('#' + prevNodeLoc.id).attr('transform', function () {
                //_log('reposition to [x: ' + prevNodeLoc.x + ', y: ' + prevNodeLoc.y);
                return 'translate(' + prevNodeLoc.x + CONST_COMMA + prevNodeLoc.y + ')';
            });

            // sync the label position
            d3.select('[bubble-label-id=' + prevNodeLoc.id + ']').style('left', function () {
                return ((margin.left + prevNodeLoc.x) - prevNodeLoc.dx / 2) + 'px';
            }).style('top', function () {
                return ((margin.top + prevNodeLoc.y) - prevNodeLoc.dy / 2) + 'px';
            });
        }

        //setTimeout(function () {
        //    force.on('tick', tick);
        //}, 100);

        force.on('tick', tick);

        //_log('drag end...');
    };

    /**
     *
     * @param nodeId - clicked node,
     * @param toShow - to show node
     */
    updateActive = function (nodeId, toShow) {

        d3.select(model.placeholder + ' #' + nodeId).classed('bubble-selected', toShow);
        // update the selected tags in the input
        updateSelections();
    };

    /**
     *
     * @param d
     * @returns {boolean}
     */
    mouseover = function (d) {

        nodes.classed('bubble-hover', function (p) {
            return p === d;
        });
        return false;
    };

    /**
     *
     * @param d
     * @returns {boolean}
     */
    mouseout = function () {

        // remove all hover styles
        //nodes.classed('bubble-masked-hover', false);
        nodes.classed('bubble-hover', false);

        return false;
    };

    /**
     * Update selected values
     */
    updateSelections = function () {

        //_log('update selection');

        var selectionsDOM = [];

        selectedNodes.forEach(function (d) {
            var itemDOM = chart.breedTagItem(d);
            selectionsDOM.push(itemDOM);
        });

        var $searchMenu = $('#searchMenu');

        if (!!selectedNodes && selectedNodes.length > 0) {
            if ($searchMenu.hasClass('hidden')) {
                $searchMenu.removeClass('hidden');
            }

            $searchMenu.show();
        } else {
            $searchMenu.hide();
        }


        d3.select('#searchTags').html(selectionsDOM.join('')).selectAll('.selected-tag').on('click', function () {
            var nodeId = d3.select(this).attr('tag-id');

            // remove from $selectedNodes
            _removeById(selectedNodes, nodeId);

            _log('selectedNodes.length: ' + selectedNodes.length);

            updateActive(nodeId, false);
        });

    };

    init(config);

    chart.jitter = function (_) {
        if (!arguments.length) {
            return jitter;
        }
        jitter = _;
        force.start();
        return chart;
    };
    chart.height = function (_) {
        if (!arguments.length) {
            return height;
        }
        height = _;
        return chart;
    };
    chart.width = function (_) {
        if (!arguments.length) {
            return width;
        }
        width = _;
        return chart;
    };
    chart.r = function (_) {
        if (!arguments.length) {
            return rValue;
        }
        rValue = _;
        return chart;
    };
    chart.breedTagItem = function (d) {
        return '<div> <i class="fa ' + chart.bubbleIcon(d) + '"></i> ' +
            '<input class="selected-tag ' + chart.bubbleColor(d) + '" type="button" ' +
            'tag-type="' + d.type + '" tag-sub-type="' + d.subType + '" tag-value="' + d.value +
            '" tag-id="' + d.id + '" title="' + d.title + '" value="' + d.title + '"> </div>';
    };

    chart.bubbleColor = function (d) {
        return d.type;
    };
    chart.bubbleIcon = function (d) {
        var icon;
        switch (d.type) {
            case 'assetclass':
                icon = 'fa-dollar';
                break;
            case CONST_REGION:
                icon = 'fa-globe';
                break;
            case 'popularword':
                icon = 'fa-tag';
                break;
            case 'topic':
                icon = 'fa-book';
                break;
            default :
                return;
        }
        return icon;
    };

    chart.deselectAll = function () {

        selectedNodes = [];
        // deselect all nodes on the chart
        d3.selectAll('a.bubble-selected').classed('bubble-selected', false);

        _log('selectedNodes.length: ' + selectedNodes.length);
    };

    chart.getRawData = function () {
        return [].concat(rawNodes);
    };

    return chart;
};

var root = typeof exports !== 'undefined' && exports !== null ? exports : this;

root.plotData = function (selector, data, plot) {
    return d3.select(selector).datum(data).call(plot);
};