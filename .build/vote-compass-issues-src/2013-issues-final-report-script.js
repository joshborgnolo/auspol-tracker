(function (config) {
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    function createChart(view) {
        return d3.select('#' + view.$root.attr('id'))
        .append('div')
        .append("svg")
        .chart("NormalisedStackedBarChart", {
            dataMapping: {
                metric: function () { return (this.demographic != 'Overall' ? this.factor + ': ' : '') + this.demographic; },
                value: function () { return +this.value; },
                series: function () { return this.response; }
            }
        })
        .width(view.$root.width())
        .metricLabelsWidth(100, true)
        .seriesScale(config.responses, config.responseColors)
        .animated(true);
    }
    function hackYLabels(view) {
        view.chart
        .metricLabelsWidth(1, true)
        .areas
        .labelsY
        .call(d3.svg.axis().scale(view.chart.y).orient('right'))
        .attr('transform', 'translate(-6,' + (view.chart._effectiveTopDecorationsHeight() - 32) + ')');
    }
    function createSort() {
        return function (row) {
            return -(config.demographics.length - _.indexOf(config.demographics, row.demographic)) - 1000 * (config.responses.length - _.indexOf(config.responses, row.response));
        };
    }
    function createView(id, title) {
        var view = {};
        // Metadata
        view.id = config.id + '__view-' + id;
        view.title = title;
        // Root element
        view.$root = $('#' + view.id);
        // Controls
        $('<label>Question: </label>').appendTo(view.$root);
        view.$questions = $('<select class="issues_report__view__questions"></select>').appendTo(view.$root);
        _.each(config.questions, function (question) {
            view.$questions.append($('<option value="' + question + '">' + question + '</option>'));
        });
        $('<label>Demographic Group: </label>').appendTo(view.$root);
        view.$factors = $('<select class="issues_report__view__factors"></select>').appendTo(view.$root);
        _.each(config.factors, function (factor) {
            view.$factors.append($('<option value="' + factor + '">' + factor + '</option>'));
        });
        // Charts or Images (depending on D3 support)
        if (window.d3) {
            // Create chart
            view.chart = createChart(view);
        } else {
            // Create placeholder images container
            view.$images = $('<div></div>').appendTo(view.$root);
        }
        
        // Sharing
        
        view.sharing = {
            text: '',
            url: ''
        };
        
        view.sharing.update = function (question, factor) {
            view.sharing.text = 'See how Australians\' views on ' + config.sharingMappings[question] + ' differ by ' + config.sharingMappings[factor];
            view.sharing.url = window.location.href.split('?')[0] + '?topic=' + encodeURIComponent(config.sharingMappings[question]) + '&group=' + encodeURIComponent(config.sharingMappings[factor]);
        };
        
        view.sharing.share = function (url, width, height, windowname) {
            if (!width) { width = 600; }
            if (!height) { height = 400; }
            if (!windowname) { windowname = 'abcnewspopup'+new Date().getTime(); }
            url += ((/\?/).test(url) ? '&' : '?') + 'layout=popup';
            var left = (screen.width - width) / 2,
                top = (screen.height - height) / 2,
                params = 'width=' + width + ',height=' + height + ',resizable=1,scrollbars=1,left='+left+',top='+top;
            window.open(url, windowname, params);
            return false;
        };
        
        view.sharing.generateText = function () {
            return encodeURIComponent(view.sharing.text || document.title);
        };
        
        view.sharing.generateUrl = function () {
            return encodeURIComponent(view.sharing.url || window.location.href);
        };
        
        view.$sharing = $('<p class="issues_report__view__sharing">Share this data:</p>').appendTo(view.$root);
        view.$twitterButton = $('<button class="btn twitter-btn">Twitter</button>').appendTo(view.$sharing);
        view.$facebookButton = $('<button class="btn facebook-btn">Facebook</button>').appendTo(view.$sharing);
        // Full Screen toggle
        if (document.body.requestFullscreen || document.body.mozRequestFullScreen || document.body.webkitRequestFullscreen) {
            view.$title = $('<h2>' + config.title + '</h2>').prependTo(view.$root);
            view.$fullscreenButton = $('<button class="btn full-screen-btn">View this chart in Full Screen</button>').appendTo(view.$root);
        }
        // Events
        view.$root
        .on('change', 'select', function (e) {
            setView(view, view.$questions.val(), view.$factors.val());
            e.preventDefault();
        })
        .on('click', '.full-screen-btn', function (e) {
            var root = view.$root.get(0);
            if (root.requestFullscreen) { root.requestFullscreen(); }
            else if (root.mozRequestFullScreen) { root.mozRequestFullScreen(); }
            else if (root.webkitRequestFullscreen) { root.webkitRequestFullscreen(); }
            e.preventDefault();
        })
        .on('click', '.twitter-btn', function (e) {
            view.sharing.share('http://twitter.com/intent/tweet?url=' + view.sharing.generateUrl() + '&hashtags=VoteCompass&related=abcnews&text=' + view.sharing.generateText(), 500, 250, 'twitter');
            e.preventDefault();
        })
        .on('click', '.facebook-btn', function (e) {
            view.sharing.share('http://www.facebook.com/sharer.php?s=100&p[url]=' + view.sharing.generateUrl() + '&p[summary]=' + view.sharing.generateText() + '%20%23VoteCompass', 500, 375, 'facebook');
            e.preventDefault();
        });
        return view;
    }
    function resizeView(view) {
        var width = view.$root.width();
        if (view.chart && view.chart.width() != width) {
            view.chart.animated(false);
            view.chart.width(width);
            hackYLabels(view);
            view.chart.animated(true);
        }
    }
    function setView(view, question, factor) {
        var factors, viewData, numDemographics;
        view.$questions.val(question);
        view.$factors.val(factor);
        factors = ['Overall', factor];
        // Update chart
        if (view.chart) {
            viewData = _(config.data)
            .filter(function (row) {
                return row.response != 'Don\'t know';
            })
            .filter(function (row) {
                return _.contains(factors, row.factor) && row.question == question;
            })
            .sortBy(createSort())
            .value();
            numDemographics = _.uniq(_.pluck(viewData, 'demographic')).length;
            view.chart
            .height(72 * numDemographics, true)
            .draw(viewData);
            hackYLabels(view);
        }
        // Update images
        if (view.$images) {
            view.$images.empty();
            _.each(factors, function (factor) {
                $('<img width="100%" />')
                .attr('title', question + ': ' + factor)
                .attr('src', config.imagePath + (factor + ' - ' + question).toLowerCase().replace(/[^\w ]+/g,'').replace(/ +/g,'-') + '.png')
                .appendTo(view.$images);
            });
        }
        
        // Update sharing
        
        view.sharing.update(question, factor);
    }
    
    function setIntialView(view) {
        var inverseSharingMappings = _.invert(config.sharingMappings);
        var initialQuestion = inverseSharingMappings[getParameterByName('topic')];
        var initialFactor = inverseSharingMappings[getParameterByName('group')];
        
        if (!_.contains(config.questions, initialQuestion)) {
            initialQuestion = config.questions[0];
        }
        
        if (!_.contains(config.factors, initialFactor)) {
            initialFactor = config.factors[0];
        }
                   
        setView(view, initialQuestion, initialFactor);
    }
    function init() {
        // Create view
        var views = [
            createView('issues', 'Issues: Final Report')
        ];
        // Get real data if D3 is supported, then show the views
        if (window.d3) {
            d3.csv(config.dataURL, function (data) {
                config.data = data;
                setIntialView(views[0]);
            });
        } else {
            setIntialView(views[0]);
        }
        // Allow in-article triggering of view updates
        $(document).on('click', 'a[href="#interactive"]', function (e) {
            var questionAndFactor = $(this).attr('title').split(' : ');
            setView(views[0], questionAndFactor[0], questionAndFactor[1]);
            e.preventDefault();
        });
        // Tell view to resize when the window does
        if (window.addEventListener) {
            window.addEventListener('resize', _.debounce(function () {
                views.forEach(function (view) {
                    resizeView(view);
                });
            }, 100), false);
        }
    }
    var _onload;
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
})({
    dataURL: '/news/code/4996596/Issues+Final+Report+Data+%28CSV%29.js',
    imagePath: 'http://www.abc.net.au/dat/news/interactives/vote-compass/issues-report-fallback-images/',
    id: 'issues_report',
    title: 'Issues Final Report',
    questions: [
        'Asylum seekers who arrive by boat should not be allowed to settle in Australia.',
        'Australia should end the monarchy and become a republic.',
        'Australia should spend more on foreign aid.',
        'Boats carrying asylum seekers should be turned back.',
        'How accessible should abortion services be in Australia?',
        'How many new immigrants should Australia admit?',
        'How much federal government funding should there be for universities?',
        'How much financial support should the Commonwealth provide to the car industry?',
        'How much government regulation should there be on business?',
        'How much should the federal government do to tackle climate change?',
        'How much should the government spend on defence?',
        'How much tax should mining companies pay?',
        'Live animal exports should be banned.',
        'Marriage should only be between a man and a woman.',
        'Medicare should offer basic dental care for everyone, even if people have to pay a higher Medicare levy.',
        'Private health insurance rebates should depend on income.',
        'Students in government and non-government schools should receive the same amount of federal funding.',
        'Terminally ill patients should be able to legally end their own lives with medical assistance.',
        'The Australian constitution should recognise indigenous people as Australia\'s first inhabitants.',
        'The Commonwealth should pass laws requiring more women in senior positions.',
        'The federal government should put a price on carbon.',
        'The government should further restrict foreign ownership of Australian agricultural land.',
        'The government\'s parental leave pay should be the same for all working mothers.',
        'The National Broadband Network should deliver faster speeds even if it costs more.',
        'The national budget deficit should be reduced, even if it means fewer public services.',
        'There should be fewer restrictions on coal seam gas exploration.',
        'There should be more restrictions on 457 visas issued to temporary foreign workers.',
        'Trade unions have too much power in the workplace.',
        'When there is an economic problem government spending usually makes it worse.',
        'Workplace protections have gone too far.'
    ],
    responses: [
        'Strongly Disagree',
        'Much less',
        'Many fewer',
        'Somewhat Disagree',
        'Somewhat less',
        'Somewhat fewer',
        'Neutral',
        'About the same as now',
        'Somewhat Agree',
        'Somewhat more',
        'Strongly Agree',
        'Many more',
        'Much more',
        'Don\'t know'
    ],
    responseColors: [
        'rgb(284,182,134)', //  --|    Strongly Disagree
        'rgb(284,182,134)', //  --|    Much less
        'rgb(284,182,134)', //  --|    Many fewer
        'rgb(237,201,171)', //   -|    Somewhat Disagree
        'rgb(237,201,171)', //   -|    Somewhat less
        'rgb(237,201,171)', //   -|    Somewhat fewer
        'rgb(208,195,180)', //    ~    Neutral
        'rgb(208,195,180)', //    ~    About the same as now
        'rgb(201,230,235)', //    |+   Somewhat Agree
        'rgb(201,230,235)', //    |+   Somewhat more
        'rgb(146,211,222)', //    |++  Strongly Agree
        'rgb(146,211,222)', //    |++  Many more
        'rgb(146,211,222)', //    |++  Much more
        'transparent'       //    ?    Don't know
    ],
    factors: [
        // 'Overall',
        'Age',
        'Birthplace',
        'Education',
        'Gender',
        'Ideology',
        'Income',
        'Industry',
        'Language',
        'Marriage',
        'Political Interest',
        'Religion',
        'Rural vs Urban',
        'State',
        'Student',
        'Vote Intention'
    ],
    demographics: [
        // Overall
        'Overall',
        // Age
        '18-34',
        '35-54',
        '55+',
        // Birthplace
        'Born in Australia',
        'Born outside Australia',
        // Education
        'No uni degree',
        'Uni degree',
        // Gender
        'Men',
        'Women',
        // Ideology
        'Left',
        'Centre-left',
        'Centre',
        'Centre-right',
        'Right',
        // Income
        '< $800 pw',
        '$800-$2000 pw',
        '> $2000 pw',
        // Industry
        'Arts, Education, and Information',
        'Financial and Professional Services',
        'Health and Public Services',
        'Labourers',
        'Other Services',
        'Retail Trade',
        'Retired and Unemployed',
        // Language
        'English',
        'Other language',
        // Marriage
        'Married',
        'Single',
        // Political Interest
        'None',
        'Not much',
        'Some',
        'A good deal',
        // Religion
        'Catholic',
        'Protestant',
        'Uniting',
        'Other religion',
        'No religion',
        // Rural vs Urban
        'Inner metro',
        'Outer metro',
        'Regional',
        'Rural',
        // State
        'ACT',
        'NSW',
        'NT',
        'Qld',
        'SA',
        'Tas',
        'Vic',
        'WA',
        // Student
        'Student',
        'Non-student',
        // Vote Intention
        'Labor',
        'Coalition',
        'Greens',
        'Other'
    ],
    sharingMappings: {
        'Asylum seekers who arrive by boat should not be allowed to settle in Australia.': 'settlement of asylum seekers',
        'Australia should end the monarchy and become a republic.': 'a republic',
        'Australia should spend more on foreign aid.': 'foreign aid',
        'Boats carrying asylum seekers should be turned back.': 'turning back asylum boats',
        'How accessible should abortion services be in Australia?': 'access to abortion services',
        'How many new immigrants should Australia admit?': 'immigration',
        'How much federal government funding should there be for universities?': 'university funding',
        'How much financial support should the Commonwealth provide to the car industry?': 'car industry support',
        'How much government regulation should there be on business?': 'regulation on businesses',
        'How much should the federal government do to tackle climate change?': 'climate change',
        'How much should the government spend on defence?': 'defence spending',
        'How much tax should mining companies pay?': 'mining taxes',
        'Live animal exports should be banned.': 'live animal exports',
        'Marriage should only be between a man and a woman.': 'gay marriage',
        'Medicare should offer basic dental care for everyone, even if people have to pay a higher Medicare levy.': 'Medicare dental coverage',
        'Private health insurance rebates should depend on income.': 'health insurance rebates',
        'Students in government and non-government schools should receive the same amount of federal funding.': 'school funding',
        'Terminally ill patients should be able to legally end their own lives with medical assistance.': 'legalisation of euthanasia',
        'The Australian constitution should recognise indigenous people as Australia\'s first inhabitants.': 'Indigenous recognition',
        'The Commonwealth should pass laws requiring more women in senior positions.': 'quotas for female managers',
        'The federal government should put a price on carbon.': 'carbon pricing',
        'The government should further restrict foreign ownership of Australian agricultural land.': 'foreign ownership of farms',
        'The government\'s parental leave pay should be the same for all working mothers.': 'paid parental leave',
        'The National Broadband Network should deliver faster speeds even if it costs more.': 'the NBN',
        'The national budget deficit should be reduced, even if it means fewer public services.': 'the budget deficit',
        'There should be fewer restrictions on coal seam gas exploration.': 'CSG exploration',
        'There should be more restrictions on 457 visas issued to temporary foreign workers.': 'visas for foreign workers',
        'Trade unions have too much power in the workplace.': 'trade unions\' power',
        'When there is an economic problem government spending usually makes it worse.': 'government spending',
        'Workplace protections have gone too far.': 'workplace protections',
        'Age': 'age',
        'Birthplace': 'birthplace',
        'Education': 'education',
        'Gender': 'gender',
        'Ideology': 'ideology',
        'Income': 'income',
        'Industry': 'industry',
        'Language': 'language',
        'Marriage': 'marriage',
        'Political Interest': 'political interest',
        'Religion': 'religion',
        'Rural vs Urban': 'location',
        'State': 'state',
        'Student': 'student status',
        'Vote Intention': 'vote intention'
    }
});
