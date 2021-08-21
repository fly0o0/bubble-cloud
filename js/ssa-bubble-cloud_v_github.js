/**
 * Created by e524935 on 3/3/15.
 */

 'use strict';

 window.BubbleCloud = function (config) {
    
     var chart, collide, connectEvents, force, gravity, transformData;
 
     var nodes = null;
     var labels = null;
 
     var tick, dragTick, locateRegions;
 
     var dblclick, dragstart, drag, draging, dragend, mouseover, mouseout; // event handlers
 
     var update, updateActive, updateLabels, updateNodes, updateSelections;
 
     var rawNodes = [];   // the original/complete copy of data
     var data = [];          // the current copy of data used to plot the chart
     var selectedNodes = [];  // selected data
 
     var PointGenerator;
 
     var collideV2;
     var dragSourceNode, dropTargetNode;
     var isMergePending = false;
     var isMergeDone = false;
     var isActiveDragEvent = false;
     var mergeNodes, demergeNodes, showSubRegions, hideSubRegions, toggleRegions;
     var mergeMap = [];      //
     var prevNodeLoc = {id: null, x: null, y: null};   // previous location of the dragged node
 
     var CONST_COMMA = ',', CONST_SPACE = ' ', CONST_PLUS = '(+)', CONST_MINUS = '(-)',
         CONST_REGION = 'region', CONST_COUNTRY = 'country';
 
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
             if (d.tagType === CONST_REGION && !!d.refs && d.refs.length !== 0) {
 
                 d.name = d.tagName + CONST_SPACE + CONST_PLUS;
                 // display name
             } else {
                 d.name = d.tagName;     // display name
             }
 
             d.value = d.tagName;    // real value
             d.type = d.tagType;
             d.id = d.type + '-' + d.tagId;
             d.selected = false;
 
         });
 
         // save the raw data for future reference
         rawNodes = [].concat(rawData);
 
         return rawData;
     };
 
     function _locateNodes() {
         nodes.attr('transform', function (d) {
             return 'translate(' + d.x + CONST_COMMA + d.y + ')';
         });
     }
 
     function _locateLabels(labels) {
         return labels.style('left', function (d) {
             return ((margin.left + d.x) - d.dx / 2) + 'px';
         }).style('top', function (d) {
             return ((margin.top + d.y) - d.dy / 2) + 'px';
         });
     }
 
     /**
      * the default force layout simulation one step
      */
     tick = function (e) {
         var dampenedAlpha;
         dampenedAlpha = e.alpha * 0.1;
         nodes.each(gravity(dampenedAlpha)).each(moveToParent(dampenedAlpha))
             .each(collide(jitter));
         _locateNodes();
         return _locateLabels(labels);
     };
 
     /**
      * the dragging force layout simulation one step
      *
      */
     dragTick = function () {
         // reposition the node/circle
         _locateNodes();
         nodes.each(collideV2(jitter));
         return _locateLabels(labels);
     };
 
     locateRegions = function () {
         // reposition the node/circle
         _locateNodes();
         return _locateLabels(labels);
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
 
         nodeEnter.append('title')
             .text(function (d) {
                 return d.title;
             });
 
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
             var fsize = Math.max(8, rScale(rValue(d) / 6) / 1.5);
             if (!!d.isMergedNode) {
                 fsize = Math.max(8, fsize / 1.2);
             }
             return fsize + 'px';
         });
 
         labelEnter.append('div').attr('class', 'bubble-label-name').html(function (d) {
             var separator, wordNumEveryLine, words;
 
             function _buildWordsToDisplay(words, wordNumEveryLine, separator) {
                 var connectSymbol, resultText = '', wordNum;
                 wordNum = words.length;
                 for (var i = 0; i < wordNum; i++) {
 
                     if ((i + 1) % wordNumEveryLine === 0) {
                         if (separator === CONST_SPACE) {
                             connectSymbol = '<br>';
                         } else {
                             connectSymbol = '<br>' + separator;
                         }
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
                     resultText = resultText.replace(/\,\(\+\)/, CONST_PLUS);
                 }
                 //change space to html entity(non break line) of space, for ie
                 resultText = resultText.replace(/ /, '&nbsp;');
 
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
 
             return _buildWordsToDisplay(words, wordNumEveryLine, separator);
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
         if (source.isSatelliteNode || target.isSatelliteNode || source.isShowAll || target.isShowAll) {
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
 
         var sourceIndex = _findIndex(data, source.id);
         var sourceNode = data.splice(sourceIndex, 1)[0];
         addIdsToRemove(source, sourceNode, idsToRemove);
 
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
         //If find no element, then return
         if (index === -1) {
             return;
         }
 
         arr.splice(index, 1);
     }
 
     /**
      * demerge the selected node and split into individual nodes
      * @param d - selected merged node
      */
     demergeNodes = function (d) {
 
 
         // Step 1: remove the merged node
         _removeById(data, d.id);
 
         // Step 2: update the entry from $mergeMap
         _removeById(mergeMap, d.mid);
 
         // Step 3: add back all member nodes of $d
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
         var region, index, nodeToAdd, refs = node.refs;
 
         node.isShowAll = true;
         if (!!refs && refs.length !== 0) {
             node.name = node.name.replace(/\(\+\)/, CONST_MINUS);
         }
 
         d3.select(model.placeholder + ' [bubble-label-id="' + node.id + '"] > div:first-child').text(function () {
             return node.name;
         });
 
         PointGenerator.locateSubRegions(node);
 
         for (index = 0; index < refs.length; index++) {
             region = refs[index];
             region.id = node.id + '_' + index;
 
             nodeToAdd = {
                 title: region.tagName,
                 value: region.tagName,
                 name: region.tagName,
                 angle: region.angle,
                 isSatelliteNode: true,
                 count: parseInt(region.nbArticles),
                 id: region.id,
                 type: CONST_REGION,
                 subType: CONST_COUNTRY,
                 selected: region.selected,
                 x: node.x - region.point.x,
                 y: node.y - region.point.y,
                 dx: node.dx,
                 dy: node.dy,
                 parent: node
             };
 
             data.push(nodeToAdd);
         }
 
         update();
         locateRegions();
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
 
     PointGenerator = (function () {
         var F;
 
         F = function () {
         };
 
         function _sortByArticles(arr) {
             arr.sort(function (a, b) {
                 return parseInt(a.nbArticles) < parseInt(b.nbArticles);
             });
         }
 
         function _findMaxArticles(arr) {
             var max = 0, articleNum;
             for (var i = 0; i < arr.length; i++) {
                 articleNum = parseInt(arr[i].nbArticles);
                 if (max < articleNum) {
                     max = articleNum;
                 }
             }
             return max;
         }
 
         function _removeByIndex(arr, index) {
             if (index === -1) {
                 return;
             }
             arr.splice(index, 1);
         }
 
         /**
          * Get point at the circle's arc based on polar coordinate.
          *
          * @param r
          * The radius of circle
          *
          * @param angle
          *
          * The angle of radian
          * @returns {{}}
          * @private
          */
         function _getPoint(r, angle) {
             var radianOf1 = Math.PI / 180;
             var result = {};
             result.x = r * Math.cos(angle * radianOf1);
             result.y = r * Math.sin(angle * radianOf1);
             return result;
         }
 
         /**
          * Get angle of correspondent centre of trace circle.
          *
          * @param rSatellite
          * The radius of satellite circle
          * @param rTraceCircle
          * The radius of trace circle
          * @returns {number}
          * @private
          */
         function _getCentreAngleOfTraceCircle(rSatellite, rTraceCircle) {
 
             var distanceToChordTraceCentre = _getDistanceIntersectingChordToCentre(rSatellite, rTraceCircle);
             return _getCentreAngle(distanceToChordTraceCentre, rTraceCircle);
         }
 
         /**
          * Get distance from the intersecting chord to the centre of trace circle.
          *
          * Scenario: Trace circle's arc pass the centre of circle.
          * i.e. A circle's centre is on trace circle's arc
          *
          *
          * rTraceCircle is the radius of trace circle
          *
          * a + b = rTraceCircle;
          *
          * a*a + x*x = rTraceCircle*rTraceCircle;
          *
          * b*b + x*x = rSatellite*rSatellite;
          *
          * x is half of chord length,
          * The chord is in the satellite circle.
          *
          * a is distance from the chord to the centre of trace circle,
          * b is distance from the chord to the centre of satellite circle
          *
          * @param rSatellite
          * The radius of satellite circle
          * @param rTraceCircle
          * The radius of trace circle
          * @returns {number}
          * distance from the chord to the centre
          * @private
          */
         function _getDistanceIntersectingChordToCentre(rSatellite, rTraceCircle) {
             return rTraceCircle - Math.pow(rSatellite, 2) / (2 * rTraceCircle);
         }
 
         /**
          * Get centre angle of trace centre of the intersecting chord.
          *
          * @param distanceToChordTraceCentre
          * Distance between intersecting chord to trace circle's centre.
          *
          * @param rTraceCircle
          * The radius of trace circle.
          *
          * @returns {number}
          * @private
          */
         function _getCentreAngle(distanceToChordTraceCentre, rTraceCircle) {
             return Math.acos(distanceToChordTraceCentre / rTraceCircle) * 180 / Math.PI * 2;
         }
 
         /**
          * Get radius of the trace circle,
          * trace circle is a circle that sub region's centre will locate on its arc.
          *
          * @param rBase
          * The radius of the base circle.
          * @param rAdded
          * The radius of a circle on the trace circle.
          * @param padding
          * If you need, set it.
          * @returns the radius of the trace circle
          * @private
          */
         function _getRadiusTraceCircle(rBase, rAdded, padding) {
             padding = padding || 0;
             return rBase + rAdded + padding;
         }
 
         function _getAngle(angle, centreAngle, anglePadding) {
             return angle + (centreAngle + anglePadding);
         }
 
         function _getAnglePadding(centreAngle, divide) {
             if (divide === undefined) {
                 divide = 1 / 10;
             }
             return centreAngle * divide;
         }
 
         /**
          * Set point and angle to sub region.
          *
          * @param node
          */
         F.locateSubRegions = function (node) {
             var angleSum = 0, rMaxSubRegion, region, rSubRegion,
                 anglePadding, rTraceCircle, centreAngle, maxArticles, refs = node.refs, refsCopy;
 
             //sort sub regions by articles
             _sortByArticles(refs);
             //copy sub regions arr for calculating left sub regions' max article
             refsCopy = [].concat(refs);
             maxArticles = _findMaxArticles(refsCopy);
             rMaxSubRegion = rScale(maxArticles);
 
             //Simply use max articles to calculate the radius of trace circle.
             rTraceCircle = _getRadiusTraceCircle(node.forceR, rMaxSubRegion);
 
             for (var index = 0; index < refs.length; index++) {
                 region = refs[index];
                 rSubRegion = rScale(region.nbArticles);
                 region.id = node.id + '_' + index;
 
                 //Use radius of each sub region to calculate the centre angle
                 centreAngle = _getCentreAngleOfTraceCircle(rSubRegion, rTraceCircle);
                 anglePadding = _getAnglePadding(centreAngle, 0);
                 angleSum = _getAngle(angleSum, centreAngle, anglePadding);
 
                 //If Overflow 360, create a new trace circle to draw satellite circle and recalculate the angle and angle padding.
                 if (angleSum > 360) {
                     angleSum = 0;
 
                     //Simply use max articles to calculate the radius of trace circle.
                     //The radius of max sub region is used previous trace circle.
                     rTraceCircle = _getRadiusTraceCircle(rTraceCircle, 2 * rMaxSubRegion, -rMaxSubRegion);
                     //Use radius of each sub region to calculate the centre angle
                     centreAngle = _getCentreAngleOfTraceCircle(rSubRegion, rTraceCircle);
                     anglePadding = _getAnglePadding(centreAngle, 0);
                     angleSum = _getAngle(angleSum, centreAngle, anglePadding);
 
                     //recalculate max articles of left sub regions for next new trace circle.
                     maxArticles = _findMaxArticles(refsCopy);
                     rMaxSubRegion = rScale(maxArticles);
                 }
 
                 _removeByIndex(refsCopy, index);
 
                 //set point and angle
                 region.angle = angleSum;
                 region.point = _getPoint(rTraceCircle, angleSum);
             }
         };
 
         return F;
     })();
 
     gravity = function (alpha) {
         var ax, ay, cx, cy;
         cx = width / 2;
         cy = height / 2;
         ax = alpha / 8;
         ay = alpha;
         return function (d) {
 
             if (d.subType === CONST_COUNTRY) {
                 return;
             }
             d.x += (cx - d.x) * ax;
             return d.y += (cy - d.y) * ay;
         };
     };
 
     function moveToParent(alpha) {
         var ax, ay;
         ax = alpha;
         ay = alpha;
 
         return function (d) {
             if (d.subType === CONST_COUNTRY) {
 
                 d.x += (d.parent.x - d.x) * ax;
                 d.y += (d.parent.y - d.y) * ay;
             }
 
             return;
         };
     }
 
     collide = function (jitter) {
         return function (d) {
             return data.forEach(function (d2) {
                 var distance, minDistance, moveX, moveY, x, y;
                 if (d !== d2) {
 
                     if ((d === d2.parent && d2.subType === CONST_COUNTRY) ||
                         (d2 === d.parent && d.subType === CONST_COUNTRY) ||
                         (d.subType === CONST_COUNTRY && d2.subType === CONST_COUNTRY && d.parent === d2.parent)) {
                         collisionPadding = 0;
                     } else {
                         collisionPadding = 15;
                     }
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
 
         _log('entering collideV2');
 
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
 
                                 _log('dragging: ' + dragSourceNode.tagName);
 
                                 var dragNodeId = dragSourceNode.id;
 
                                 if ((d.id === dragNodeId || d2.id === dragNodeId) && (distance <= minDistanceJoin)) {
 
                                     if (d.type === d2.type) {
 
                                         dropTargetNode = (d.id === dragNodeId) ? d2 : d;
 
                                         isMergePending = true;
 
                                         _log('about to merge $' + dragSourceNode.tagName + '$ into $' + dropTargetNode.tagName + '$');
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
 
         _log('d.selected: ' + d.selected);
         _log('selectedNodes.length: ' + selectedNodes.length);
 
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
 
         _log('drag start...');
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
 
         _log('save current position [x: ' + prevNodeLoc.x + ', y: ' + prevNodeLoc.y);
         _log('set dragSourceNode to ' + dragSourceNode.tagName);
 
         // lock all the other nodes by disabling drag behavior temporarily
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
         _locateLabels(d3.select(model.placeholder + ' [bubble-label-id=' + nodeId + ']'));
     };
 
     dragend = function () {
 
         // unlock all nodes
         nodes.call(drag).classed('fixed', false);
 
         // lock $dropTargetNode
         if (!!dropTargetNode) {
             nodes.select('#' + dropTargetNode.id).classed('fixed', true);
         }
 
         force.on('tick', null);
 
         if (!!isMergePending) {
 
             mergeNodes(dragSourceNode, dropTargetNode);
 
             // TODO: re-position the dragged node to its previous [dx, dy] if no merge happened
 
             // starts a transition
             d3.select('#' + prevNodeLoc.id).attr('transform', function () {
                 _log('reposition to [x: ' + prevNodeLoc.x + ', y: ' + prevNodeLoc.y);
                 return 'translate(' + prevNodeLoc.x + CONST_COMMA + prevNodeLoc.y + ')';
             });
 
             // sync the label position
             d3.select('[bubble-label-id=' + prevNodeLoc.id + ']').style('left', function () {
                 return ((margin.left + prevNodeLoc.x) - prevNodeLoc.dx / 2) + 'px';
             }).style('top', function () {
                 return ((margin.top + prevNodeLoc.y) - prevNodeLoc.dy / 2) + 'px';
             });
         }
 
         force.on('tick', tick);
 
         _log('drag end...');
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
 
     mouseout = function () {
 
         // remove all hover styles
         nodes.classed('bubble-hover', false);
 
         return false;
     };
 
     /**
      * Update selected values
      */
     updateSelections = function () {
 
         _log('update selection');
 
         var selectionsDOM = [];
 
         selectedNodes.forEach(function (d) {
             var itemDOM = chart.buildTagItem(d);
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
     chart.buildTagItem = function (d) {
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
 
         $('#searchTags').empty();
         $('#searchMenu').hide();
 
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


d3.selection.prototype.first = function() {
    return d3.select(this[0][0]);
};
d3.selection.prototype.last = function() {
    var last = this.size() - 1;
    return d3.select(this[0][last]);
};

d3.selection.prototype.id = function(id) {
    var elements = this[0];
    for (var index in elements ){
        if(elements[index].id === id){
            return d3.select(elements[index]);
        }
    }
};
$(function () {

//    var title = 'QLS Tag Cloud';
//    var url = 'data/tagcloud.csv';
    var actionUrl = 'data/tags.json';   // for local testing
    //var actionUrl = '../action/getMasterTags.action';

    var plot = BubbleCloud();

    d3.json(actionUrl, function (data) {
        if (!!data && !!data.records) {
            plotData("#bubble-cloud", data.records, plot);
        }
    });
});