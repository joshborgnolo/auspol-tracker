(function() {
var _onload;

function init() {
    var csvDataURL = '/news/code/4867996/Salience+Chart+Data+%28CSV%29+%281%29.js';
    var seriesStyles = [
        ['Overall', '#17BECF', 'circle'],
        ['ALP', '#B54040', 'circle'],
        ['LIB', '#3666AC', 'circle'],
        ['GRN', '#748829', 'diamond'],
        ['NAT', '#387871', 'circle'],
        ['KAP', '#795A40', 'diamond'],
        ['PUP', '#E37512', 'square'],
        ['Left', '#17BECF', 'circle'],
        ['Centre-left', '#E377C2', 'diamond'],
        ['Centre', '#9467BD', 'square'],
        ['Centre-right', '#7F7F7F', 'diamond'],
        ['Right', '#2CA02C', 'square'],
        ['Men', '#17BECF', 'circle'],
        ['Women', '#E377C2', 'diamond'],
        ['18-34', '#17BECF', 'circle'],
        ['35-54', '#E377C2', 'diamond'],
        ['55+', '#9467BD', 'square'],
        ['Australia', '#17BECF', 'circle'],
        ['Overseas', '#E377C2', 'diamond'],
        ['University degree', '#17BECF', 'circle'],
        ['No degree', '#E377C2', 'diamond'],
        ['< $800 pw', '#17BECF', 'circle'],
        ['$800-$2000 pw', '#E377C2', 'diamond'],
        ['> $2000 pw', '#9467BD', 'square'],
        ['ACT', '#17BECF', 'circle'],
        ['NSW', '#E377C2', 'diamond'],
        ['NT', '#9467BD', 'square'],
        ['Qld', '#7F7F7F', 'diamond'],
        ['SA', '#2CA02C', 'square'],
        ['Tas', '#FF7F0E', 'diamond'],
        ['Vic', '#8C564B', 'circle'],
        ['WA', '#BCBD22', 'circle'],
        ['None', '#17BECF', 'circle'],
        ['Not much', '#E377C2', 'diamond'],
        ['Some', '#9467BD', 'square'],
        ['A good deal', '#7F7F7F', 'diamond']
    ];
    var rankedSeries = _.pluck(seriesStyles, 0);

    var seriesGroupImages = {
      'Overall':            '/news/contentblob/4875866/Overall/data.png',
      'Vote Intention':     '/news/contentblob/4875902/Vote+Intention/data.png',
      'Ideology':           '/news/contentblob/4875888/Ideology/data.png',
      'Gender':             '/news/contentblob/4875886/Gender/data.png',
      'Age':                '/news/contentblob/4875882/Age/data.png',
      'Income':             '/news/contentblob/4875890/Income/data.png',
      'Region':             '/news/contentblob/4875900/Region/data.png',
      'Political Interest': '/news/contentblob/4875898/Political+Interest/data.png'
    };
    var seriesNames = _.pluck(seriesStyles, 0);
    var seriesColors = _.pluck(seriesStyles, 1);
    var seriesSymbols = _.pluck(seriesStyles, 2);
    var dataGroupedBySeries = {};
    var chartCanvasOptions = {
        dataMapping: {
            metric: function () { return this.metric; },
            value: function () { return this.value; },
            series: function () { return this.series; }
        }
    };

    var $desktopView = $('.salience-report-desktop-view');

    var $desktopSelect = $('#salience-report-desktop-select');
    $desktopSelect.on('click', '.btn', function (e) {
        showGroup($(this).text());
        e.preventDefault();
    });

    var $fullscreenButton = $('#salience-report-desktop-fullscreen-button');
    var fullscreenButtonEl = $fullscreenButton.get(0);
    if (fullscreenButtonEl.requestFullscreen || fullscreenButtonEl.mozRequestFullScreen || fullscreenButtonEl.webkitRequestFullscreen) {
        $fullscreenButton
        .on('click', function () {
            var desktopViewEl = $desktopView.get(0);
            if (desktopViewEl.requestFullscreen) {
                desktopViewEl.requestFullscreen();
            } else if (desktopViewEl.mozRequestFullScreen) {
                desktopViewEl.mozRequestFullScreen();
            } else if (desktopViewEl.webkitRequestFullscreen) {
                desktopViewEl.webkitRequestFullscreen();
            }
        })
        .addClass('enabled');
    }
    var $desktopChart = $('#salience-report-desktop-chart');
    var desktopChartCanvas;
    var desktopChartImg;
    var $mobileSelect = $('#salience-report-mobile-select');
    $mobileSelect.on('change', function (e) {
        showGroup($(this).val());
        e.preventDefault();
    });
    var $mobileChart = $('#salience-report-mobile-chart');
    var mobileChartCanvases = {};
    function onResize() {
        var width = $desktopChart.width();
        if (desktopChartCanvas.width() != width) {
            desktopChartCanvas.width(width);
        }
        _.each(mobileChartCanvases, function (mobileChartCanvas) {
            if (mobileChartCanvas.width() != width) {
                mobileChartCanvas.width(width).width(width);
            }
        });
    }
    if (window.addEventListener) {
        window.addEventListener('resize', _.debounce(onResize, 250), false);
    }
    function showGroup(seriesGroupName) {
        $desktopSelect.find('.btn').removeClass('active').each(function () {
            var $btn = $(this);
            if ($btn.text() == seriesGroupName) {
                $btn.addClass('active');
            }
        });
        $mobileSelect.val(seriesGroupName);
        if (window.d3) {
            var domainMax = _.max(_.map(dataGroupedBySeries[seriesGroupName], function (row) { return +row.value; }));
            desktopChartCanvas
            .valueDomain(0, domainMax)
            .draw(dataGroupedBySeries[seriesGroupName]);

            _.each(mobileChartCanvases, function (mobileChartCanvas, metricName) {
                mobileChartCanvas
                .valueDomain(0, domainMax)
                .draw(dataGroupedBySeries[seriesGroupName].filter(function (row) {
                    return row.metric == metricName;
                }));
            });
        } else {
            desktopChartImg.attr('src', seriesGroupImages[seriesGroupName]);
        }
    }
    function makeMobileChartCanvas() {
        return d3.select('#' + $mobileChart.attr('id'))
        .append('div')
        .append("svg")
        .chart("OrdinalScatterPlot", chartCanvasOptions)
        .height(44, true)
        .width($mobileChart.width())
        .hideLegend()
        .metricLabelsWidth(0, true) // TODO: Change to hideMetricLabels
        .seriesScales(seriesNames, seriesColors, seriesSymbols)
        .formatLabelsX(function (x) { return x + '%'; });
    }
    if (window.d3) {
        d3.csv(csvDataURL, function (sourceData) {
            var metricNames = _.uniq(_.pluck(sourceData, 'metric'));
            var overallRankedMetricNames = _.pluck(
                _(sourceData)
                    .filter(function (row) {
                        return row.seriesGroup == 'Overall';
                    })
                    .sortBy(function (row) { return -row.value; })
                    .value(),
                'metric'
            );
            desktopChartCanvas = d3.select('#' + $desktopChart.attr('id'))
            .append("svg")
            .chart("OrdinalScatterPlot", chartCanvasOptions)
            .width($desktopChart.width())
            .height(metricNames.length * 44, true)
            .metricLabelsWidth(170, true)
            .seriesScales(seriesNames, seriesColors, seriesSymbols)
            .formatLabelsX(function (x) { return x + '%'; })
            .animated(true);
            _.each(overallRankedMetricNames, function (metricName, index) {
                var chartCanvas = makeMobileChartCanvas().title(metricName);
                if (index === 0) { chartCanvas.showLegend(); }
                if (index === overallRankedMetricNames.length - 1) { chartCanvas.showLabelsX(); }
                mobileChartCanvases[metricName] = chartCanvas;
            });
            _.each(mobileChartCanvases, function (chartA) {
                _.each(mobileChartCanvases, function (chartB) {
                    if (chartA !== chartB) {
                        chartA.linkSymbiote(chartB);
                    }
                });
            });
            dataGroupedBySeries = _.zipObject(_.uniq(_.pluck(sourceData, 'seriesGroup')), []);
            _.each(_.keys(dataGroupedBySeries), function (seriesGroupName) {
                $desktopSelect.append($('<button class="btn">' + seriesGroupName + '</button>'));
                $mobileSelect.append($('<option value="' + seriesGroupName + '">' + seriesGroupName + '</option>'));
                dataGroupedBySeries[seriesGroupName] = _(sourceData)
                    .filter(function (row) {
                        return row.seriesGroup == seriesGroupName;
                    })
                    .sortBy(function (row) { return -(overallRankedMetricNames.length - _.indexOf(overallRankedMetricNames, row.metric)) - 1000 * (rankedSeries.length - _.indexOf(rankedSeries, row.series)); })
                    .value();
            });
            $desktopSelect.find('.btn').first().click();
        });
    } else {
        desktopChartImg = $('<img width="700" height="830" />').appendTo($desktopChart);
        _.each(_.keys(seriesGroupImages), function (seriesGroupName) {
            $desktopSelect.append($('<button class="btn">' + seriesGroupName + '</button>'));
        });
        $desktopSelect.find('.btn').first().click();
    }
}
// Allow this script to be included before jQuery
if (window.jQuery) {
    $(init);
} else {
    if (typeof window.onload == 'function') {
        _onload = window.onload;
        window.onload = function () {
            _onload();
            init();
        };
    } else {
        window.onload = init;
    }
}
})();
