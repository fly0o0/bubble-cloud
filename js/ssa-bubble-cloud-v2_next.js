/**
 * Created by e524935 on 3/3/15.
 */

var BubbleCloud = function () {
    var chart, clear, click, collide, collisionPadding, connectEvents, data,
        force, gravity, height, idValue, jitter, label, margin, maxRadius,
        minCollisionRadius, mouseout, mouseover, node, rScale, rValue, textValue,
        tick, transformData, update, updateActive, updateLabels, updateNodes, width,
        typeValue, dblclick, updateSelections, parentIdValue, countValue, realIdValue;
    width = 980;
    height = 510;
    data = [];
    node = null;
    label = null;
    margin = {
        top: 5,
        right: 0,
        bottom: 0,
        left: 0
    };
    maxRadius = 65;
    rScale = d3.scale.sqrt().range([0, maxRadius]);
    rValue = function (d) {
        return countValue(d);
    };
    idValue = function (d) {
        return '_' + d.tagId;
    };
    typeValue = function (d) {
        return d.tagType;
    };
    textValue = function (d) {
        return d.tagName;
    };
    // get parent tag of current tag
    parentIdValue = function (d) {
        return (d.parentId) ? ('_' + d.parentId) : '';
    };
    countValue = function (d) {
        return parseInt(d.nbArticles);
    };
    collisionPadding = 4;
    minCollisionRadius = 12;
    jitter = 0.5;
    transformData = function (rawData) {
        rawData.forEach(function (d) {
            d.count = countValue(d);
            return rawData.sort(function () {
                return 0.5 - Math.random();
            });
        });
        return rawData;
    };
    tick = function (e) {
        var dampenedAlpha;
        dampenedAlpha = e.alpha * 0.1;
        node.each(gravity(dampenedAlpha)).each(collide(jitter)).attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });
        return label.style("left", function (d) {
            return ((margin.left + d.x) - d.dx / 2) + "px";
        }).style("top", function (d) {
            return ((margin.top + d.y) - d.dy / 2) + "px";
        });
    };
    force = d3.layout.force().gravity(0).charge(0).size([width, height]).on("tick", tick);
    chart = function (selection) {
        return selection.each(function (rawData) {
            var maxDomainValue, svg, svgEnter;
            data = transformData(rawData);
            maxDomainValue = d3.max(data, function (d) {
                return rValue(d);
            });
            rScale.domain([0, maxDomainValue]);
            svg = d3.select(this).selectAll("svg").data([data]);
            svgEnter = svg.enter().append("svg");
            svg.attr("width", width + margin.left + margin.right);
            svg.attr("height", height + margin.top + margin.bottom);
            node = svgEnter.append("g").attr("id", "bubble-nodes").attr("transform", "translate(" + margin.left + "," + margin.top + ")");
            node.append("rect").attr("id", "bubble-background").attr("width", width).attr("height", height).on("click", clear);
            label = d3.select(this).selectAll("#bubble-labels").data([data]).enter().append("div").attr("id", "bubble-labels");
            update();
//            hashchange();
//            return d3.select(window).on("hashchange", hashchange);
        });
    };
    update = function () {
        data.forEach(function (d, i) {
            return d.forceR = Math.max(minCollisionRadius, rScale(rValue(d)));
        });
        force.nodes(data).start();
        updateNodes();
        return updateLabels();
    };
    updateNodes = function () {
        node = node.selectAll(".bubble-node").data(data, function (d) {
            return idValue(d);
        });
        node.exit().remove();
        return node.enter().append("a").classed({
            "bubble-node": true, "parent-node": function (d) {
                return !parentIdValue(d);
            }
        }).attr("id", function (d) {
            return idValue(d);
        })
//            .attr("xlink:href",function (d) {
//                return "#" + (encodeURIComponent(idValue(d)));
//            })
            .attr("parent-id", function (d) {
                return parentIdValue(d);
            }).call(force.drag).call(connectEvents).append("circle").attr("r", function (d) {
                return rScale(rValue(d));
            });
    };
    updateLabels = function () {
        var labelEnter;
        label = label.selectAll(".bubble-label").data(data, function (d) {
            return idValue(d);
        });
        label.exit().remove();
        labelEnter = label.enter().append("a").classed({
            "bubble-label": true, "parent-node": function (d) {
                return !parentIdValue(d);
            }
        }).attr("bubble-label-id", function (d) {
            return idValue(d);
        }).attr("parent-id", function (d) {
            return parentIdValue(d);
        }).attr("href", function (d) {
            return "#" + (encodeURIComponent(idValue(d)));
        }).call(force.drag).call(connectEvents);
        labelEnter.append("div").attr("class", "bubble-label-name").text(function (d) {
            return textValue(d);
        });
        labelEnter.append("div").attr("class", "bubble-label-value").text(function (d) {
            return rValue(d);
        });
        label.style("font-size", function (d) {
            return Math.max(8, rScale(rValue(d) / 6)) + "px";
        }).style("width", function (d) {
            return 2.5 * rScale(rValue(d)) + "px";
        });
        label.append("span").text(function (d) {
            return textValue(d);
        }).each(function (d) {
            return d.dx = Math.max(2.5 * rScale(rValue(d)), this.getBoundingClientRect().width);
        }).remove();
        label.style("width", function (d) {
            return d.dx + "px";
        });
        return label.each(function (d) {
            return d.dy = this.getBoundingClientRect().height;
        });
    };
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
    connectEvents = function (d) {
        d.on("click", click);
        //
        d.on("dblclick", dblclick);
        d.on("mouseover", mouseover);
        return d.on("mouseout", mouseout);
    };
    clear = function () {
        return location.replace("#");
    };


    /**
     *
     * @param d
     * @returns {*}
     */
    click = function (d) {
        updateActive(idValue(d));
        return d3.event.preventDefault();
    };


    /**
     * double click to highlight children nodes, double click twice to remove highlight
     * @param d
     */
    dblclick = function (d) {

        var selectedNode = d3.select(this);
        var parentId;

        // 1) mask all nodes by de-selecting selected nodes
        // 1.1) de-select all nodes
        d3.selectAll("a.bubble-selected").classed("bubble-selected", false);
        // 1.2) mask all nodes
        d3.selectAll("a.bubble-node").classed("bubble-masked", true);
        // 1.3) reset style for previously selected parent node(s)
        d3.selectAll("a.bubble-label-selected.parent-node").classed("bubble-label-selected", false);

        if (selectedNode.classed('parent-node')) { // if selected node is a parent-node
            // 2a) highlight current node and its children
//            parentId = selectedNode.attr("id") || selectedNode.attr("bubble-label-id");
            parentId = idValue(d);
        }
        else { // if selected node is not a parent-node
            // 2b) highlight current node, its parent and siblings if there is any
//            parentId = selectedNode.attr('parent-id');
            parentId = parentIdValue(d);
        }

        // TODO: highlight parent node in a different color
        d3.select('[bubble-label-id=' + parentId + ']').classed('bubble-label-selected', true);
        d3.select('#' + parentId).classed({'bubble-selected': true, 'bubble-masked': false});

        // highlight all children/siblings
        d3.selectAll("[parent-id=" + parentId + "]").classed({'bubble-selected': true, 'bubble-masked': false});

        updateSelections();
    };

    /**
     *
     * @param id
     * @returns {*}
     */
    updateActive = function (id) {

        node.classed("bubble-masked", false);

        node.classed("bubble-selected", function (d) {
            // if clicked node was selected previously, un-select it, otherwise, mark it as selected
            var isSelected = d3.select("#" + idValue(d)).classed("bubble-selected");
            return (id === idValue(d)) ? !isSelected : isSelected;
        });

        d3.select('#bubble-labels').selectAll('a.bubble-label').classed("bubble-label-selected", function (d) {
            // if clicked node was selected previously, un-select it, otherwise, mark it as selected
            var isSelected = d3.select('[bubble-label-id=' + idValue(d) + ']').classed("bubble-label-selected");
            return (id === idValue(d)) ? !isSelected : isSelected;
        });

        updateSelections();
    };

    /**
     *
     * @param d
     * @returns {boolean}
     */
    mouseover = function (d) {

        // add bubble-masked-hover if current node is already masked

        // @param p - current node
        // @param d - hovered node
        node.classed("bubble-masked-hover", function (p) {
            return (p === d) ? d3.select("#" + idValue(d)).classed("bubble-masked") : false;
        });

        node.classed("bubble-hover", function (p) {
            return p === d;
        });

        return false;
    };

    /**
     *
     * @param d
     * @returns {boolean}
     */
    mouseout = function (d) {

        // remove all hover styles
        node.classed("bubble-masked-hover", false);
        node.classed("bubble-hover", false);

        return false;
    };

    /**
     * Update selected values
     */
    updateSelections = function () {

        var selectionsDOM = [], closeAll;

        d3.select("g").selectAll("a.bubble-selected").each(function (d) {

            var itemDOM = '<div> <i class="fa ' + chart.bubbleIcon(d) + '"></i> ' +
                '<input class="' + chart.bubbleColor(d) + 'Back" type="button" type-id="' + typeValue(d) + '" tag-id="' + idValue(d) + '" title="' + textValue(d) + '" value="' + textValue(d) + '"> ' +
                '</div>';
            selectionsDOM.push(itemDOM);
        });

        if(!!selectionsDOM){
            closeAll = '<div> <i class="fa fa-close"></i> ' +
            '<input id="resetBtn" style="background-color: #62c0df; color:#FFFFFF;border-radius: 2px;" type="button" value="DESELECT ALL"> ' +
            '</div>';
            selectionsDOM.push(closeAll);
        }

        d3.select("#searchTags").html(selectionsDOM.join('')).selectAll('input[class$="Back"]').on('click', function () {
            var tagToDeselect = d3.select(this).attr('tag-id');
            updateActive(tagToDeselect);
        });

        $('#resetBtn').on('click', function(){
            d3.selectAll("a.bubble-selected").classed("bubble-selected", false);
            d3.selectAll("a.bubble-label-selected").classed("bubble-label-selected", false);
            $('#searchTags').empty();
        });

    };

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
    chart.bubbleColor = function (d) {
        return d.tagType;
    };
    chart.bubbleIcon = function (d) {
        var icon;
        switch (d.tagType) {
            case "assetclass":
                icon = "fa-dollar";
                break;
            case "region":
                icon = "fa-globe";
                break;
            case "popularword":
                icon = "fa-tag";
                break;
            case "topic":
                icon = "fa-book";
                break;
            default :
                return;
        }
        return icon;
    };
    return chart;
};

var root = typeof exports !== "undefined" && exports !== null ? exports : this;

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