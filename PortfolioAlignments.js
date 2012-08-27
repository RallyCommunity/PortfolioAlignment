function PortfolioAlignments() {
    var rallyDataSource = null;
    var g_sizes = null;
    var g_prefs = null;
    var g_settings = null;

    var g_type = null;
    var g_allowed_colors = null;

    var g_pies = [];
    var g_data_sets = {};
    var typeDropDown = null;

    this.init = function () {
        rallyDataSource = new rally.sdk.data.RallyDataSource(
            '__WORKSPACE_OID__',
            '__PROJECT_OID__',
            '__PROJECT_SCOPING_UP__',
            '__PROJECT_SCOPING_DOWN__');

        rallyDataSource.setApiVersion("1.37");

        rally.sdk.ui.AppHeader.addPageTool({
            key: "showSettings",
            label: "Settings...",
            onClick: showSettings
        });

        var typeCfg = {
            label: 'Type: ',
            showLabel: true,
            type: 'typeDefinition',
            attribute: 'Name',
            order: 'Ordinal desc',
            fetch: 'Ordinal,TypePath',
            query: '((Parent.Name = "Portfolio Item") and (Creatable = true))'
        };

        typeDropDown = new rally.sdk.ui.ObjectDropdown(typeCfg, rallyDataSource);
        typeDropDown.display('type_chooser', onTypeChange);
    };

    var onTypeChange = function (cb, args) {
        g_type = args.item.TypePath;
        getAllowedValues(g_type);
    };

    var getAllowedValues = function (type) {
        var queryArray = [];
        queryArray.push({
            key: 'attributes',
            type: 'TypeDefinition',
            query: '( TypePath = "' + type + '" )',
            fetch: 'Attributes,AttributeDefinition,AllowedValues,ElementName,TypePath'
        });
        rallyDataSource.findAll(queryArray, processAllowedValues);
    };

    var processAllowedValues = function (results) {
        g_sizes = {};
        var allowed_values = [];
        for (var a = 0; a < results.attributes[0].Attributes.length; a++) {
            if (results.attributes[0].Attributes[a].ElementName == "InvestmentCategory") {
                allowed_values = results.attributes[0].Attributes[a].AllowedValues;
                var ratio = Math.round(100 / ( allowed_values.length - 1 ));
                for (var v = 0; v < allowed_values.length; v++) {
                    var allowed_value = allowed_values[v];
                    if (allowed_value.StringValue) {
                        g_sizes[ allowed_value.StringValue ] = ratio;
                    }
                }
            }
        }
        // set base colors
        setBaseColors(allowed_values);
        rallyDataSource.preferences.getAppPreferences(processPreferences);
    };

    var processPreferences = function (results) {
        console.log("processPreferences");
        if (results.length) {
            g_prefs = results;
            g_sizes = {};
            rally.forEach(results[0].Value.fieldInfos, function (size) {
                g_sizes[ size.label ] = parseFloat(size.investmentCategory, 10);
            });
        }
        doQuery();
    };

    var doQuery = function () {
        console.log("doQuery");
        var queryArray = [];

        var pi_query = '( PlannedEndDate > "1967-01-09" )';
        var act_query = '( ActualEndDate > "1967-01-09" )';
        queryArray.push({
            key: 'actual_items',
            type: g_type.replace(/\//g, "-"),
            query: act_query,
            order: 'PortfolioItemType',
            fetch: 'FormattedID,Name,PortfolioItemType,PreliminaryEstimate,ActualEndDate,Value,PlannedEndDate,InvestmentCategory'
        });
        queryArray.push({
            key: 'planned_items',
            type: g_type.replace(/\//g, "-"),
            query: pi_query,
            order: 'PortfolioItemType',
            fetch: 'FormattedID,Name,PortfolioItemType,PreliminaryEstimate,ActualEndDate,Value,PlannedEndDate,InvestmentCategory'
        });
        rallyDataSource.findAll(queryArray, calculateValues);
    };

    var calculateValues = function (results) {
        console.log("calculateValues");
        var target_items = [];
        var planned_items = [];
        var actual_items = [];
        rally.forEach(g_sizes, function (value, category) {
            target_items.push({ InvestmentCategory: category.replace(/\&amp;/, "&"), _EstimateRatio: value });
        });
        // cycle through planned items and calculate each's estimate
        var total_planned = 0;
        for (var p = 0; p < results.planned_items.length; p++) {
            var pi = results.planned_items[p];
            if (pi.PreliminaryEstimate) {
                pi._EstimateValue = pi.PreliminaryEstimate.Value;
            } else {
                pi._EstimateValue = 0;
            }
            total_planned += pi._EstimateValue;
            planned_items.push(pi);
        }
        // re-cycle through the planned items to calculate the percentage
        if (total_planned > 0) {
            for (var pr = 0; pr < planned_items.length; pr++) {
                planned_items[pr]._EstimateRatio = 100 * planned_items[pr]._EstimateValue / total_planned;
            }
        }

        // cycle through the actually done items and calculate estimate
        var total_actual = 0;
        for (var a = 0; a < results.actual_items.length; a++) {
            var ai = results.actual_items[a];
            if (ai.PreliminaryEstimate) {
                ai._EstimateValue = ai.PreliminaryEstimate.Value;
            } else {
                ai._EstimateValue = 0;
            }
            total_actual += ai._EstimateValue;
            actual_items.push(ai);
        }
        // we want the actual chart to represent the done percentage
        // of the overall plan
        var buffer_item = {
            InvestmentCategory: "Not Done",
            _EstimateValue: total_planned - total_actual
        };
        actual_items.push(buffer_item);
        // re-cycle through the actual items to calculate the percentage
        if (total_planned > 0) {
            for (var ar = 0; ar < actual_items.length; ar++) {
                actual_items[ar]._EstimateRatio = 100 * actual_items[ar]._EstimateValue / total_planned;
            }
        }
        //makeRallyPies( target_items, planned_items, actual_items );
        makeDojoPies(target_items, planned_items, actual_items);
        //makeTables( planned_items, actual_items );
    };

    // given an array of items with an InvestmentCategory and _EstimateValue
    // return a data hash that we can use in the pie charts
    var getData = function (item_array) {
        var data_hash = {};
        for (var i = 0; i < item_array.length; i++) {
            var item = item_array[i];
            if (!data_hash[ item.InvestmentCategory ]) {
                data_hash[ item.InvestmentCategory ] = 0;
            }
            data_hash[ item.InvestmentCategory ] += Math.round(item._EstimateRatio);
        }
        return data_hash;
    };

    // given an array of items with an InvestmentCategory and _EstimateValue
    // return a hash that we can use in the pie charts for labels
    var getValues = function (item_array) {
        var value_hash = {};
        for (var i = 0; i < item_array.length; i++) {
            var item = item_array[i];
            if (!value_hash[ item.InvestmentCategory ]) {
                value_hash[ item.InvestmentCategory ] = item.InvestmentCategory;
            }
        }
        return value_hash;
    };

    var makeDojoPies = function (target_items, planned_items, actual_items) {
        g_pies = [];
        g_data_sets = {};
        g_pies.push(makeDojoPie(target_items, "target_pie", "Target"));
        g_pies.push(makeDojoPie(planned_items, "planned_pie", "Planned"));
        g_pies.push(makeDojoPie(actual_items, "actual_pie", "Actual"));
    };

    var getHashKeys = function (hash) {
        var keys = [];
        for (var key in hash) {
            if (hash.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    };

    var makeDojoPie = function (items, div_id, title) {
        console.log("makeDojoPie");
        dojo.empty(dojo.byId(div_id));
        var pie = null;
        if (items.length === 0 || ( items.length == 1 && items[0]._EstimateValue === 0 )) {
            var data_div = document.createElement("div");
            if (data_div) {
                dojo.addClass(data_div, "full_center");
                data_div.innerHTML = "No data";
                dojo.place(data_div, dojo.byId(div_id), "last");
            }
        } else {
            var values = {};
            for (var tc in items) {
                if (items.hasOwnProperty(tc) && !isNaN(items[tc]._EstimateRatio) && ( items[tc]._EstimateRatio > 0 )) {
                    var category = items[tc].InvestmentCategory;
                    if (!values[category]) {
                        values[category] = {
                            InvestmentCategory: category,
                            _EstimateRatio: 0
                        };
                    }
                    values[ category ]._EstimateRatio += items[tc]._EstimateRatio;
                }
            }

            var data = [];
            g_data_sets[title] = {};
            var i = 0;
            for (var val in values) {
                if (values.hasOwnProperty(val)) {
                    data.push({ x: i, y: values[val]._EstimateRatio, color: g_allowed_colors[ values[val].InvestmentCategory ], title: title, tooltip: values[val].InvestmentCategory, category: values[val].InvestmentCategory });
                    // hold the percentage globally for the tooltip
                    g_data_sets[title][ values[val].InvestmentCategory ] = Math.round(10 * values[val]._EstimateRatio) / 10;
                    i++;
                }
            }
            var pie_config = { type: "Pie",
                fontColor: "black",
                labelOffset: -20,
                radius: 85
            };
            pie = new dojox.charting.Chart2D(div_id);
            pie.addPlot("default", pie_config);
            pie.addSeries(title, data);
            //var tip = new dojox.charting.action2d.Tooltip( pie, "default" );
            var tip = new dojox.charting.action2d.Tooltip(pie, "default", { text: function (e) {
                var text = "<em>None</em><br/>";
                var category = null;
                if (g_data_sets[ title ]) {
                    category = data[e.index].category;
                    text = "<em>" + category + "</em><br>";
                    if (category != "Not Done") {
                        if (g_data_sets.Target && g_data_sets.Target[ category ]) {
                            text += "<strong>Target: </strong>" + g_data_sets.Target[category] + "<br/>";
                        } else {
                            text += "<strong>Target: </strong>0<br/>";
                        }
                        if (g_data_sets.Planned && g_data_sets.Planned[category]) {
                            text += "<strong>Planned: </strong>" + g_data_sets.Planned[category];
                        } else {
                            text += "<strong>Planned: </strong>0<br/>";
                        }
                    }
                }

                return text;
            } });

            pie.render();
        }
        return pie;
    };

    var makeRallyPies = function (target_items, planned_items, actual_items) {
        var target_pie_config = { values: getValues(target_items),
            data: getData(target_items),
            colors: g_allowed_colors,
            labelOffset: "-20"
        };
        dojo.empty(dojo.byId("target_pie"));
        var target_pie = new rally.sdk.ui.PieChart(target_pie_config, rallyDataSource);
        target_pie.display("target_pie", null);

        var planned_pie_config = { values: getValues(planned_items),
            data: getData(planned_items),
            colors: g_allowed_colors
        };
        var planned_pie = new rally.sdk.ui.PieChart(planned_pie_config, rallyDataSource);
        dojo.empty(dojo.byId("planned_pie"));
        planned_pie.display("planned_pie", null);
        var actual_pie_config = { values: getValues(actual_items),
            data: getData(actual_items),
            colors: g_allowed_colors
        };
        var actual_pie = new rally.sdk.ui.PieChart(actual_pie_config, rallyDataSource);
        dojo.empty(dojo.byId("actual_pie"));
        actual_pie.display("actual_pie", null);
    };

    var makeTables = function (planned_items, actual_items) {
        var table_config = {
            columnKeys: [ 'FormattedID', 'Name', '_EstimateValue', 'PlannedEndDate', 'InvestmentCategory', 'ActualEndDate', '_EstimateRatio' ],
            columnWidths: [ '100px', '100px', '100px', '100px', '100px', '100px', '100px' ]
        };
        var planned_table = new rally.sdk.ui.Table(table_config);
        planned_table.addRows(planned_items);
        planned_table.display('planned_table');
        var actual_table = new rally.sdk.ui.Table(table_config);
        actual_table.addRows(actual_items);
        actual_table.display('actual_table');
    };

    var showSettings = function () {
        if (!g_settings) {
            g_settings = new AlignmentSettings(rallyDataSource, g_sizes, g_prefs);
            g_settings.display();
        } else {
            g_settings.show();
        }
    };

    // set base colors
    var setBaseColors = function (allowed_values) {
        g_allowed_colors = {};
        var color_array = [ "#b5d8eb", "#b2e3b6", "#fbde98", "#fcb5b1",
            "#5c9acb", "#6ab17d", "#d9af4b", "#f47168",
            "#196c89", "#3a874f", "#e5d038", "#e57e3a",
            "#ef3f35" ];

        for (var av = 0; av < allowed_values.length; av++) {
            if (color_array[av] && allowed_values[av].StringValue) {
                g_allowed_colors[ allowed_values[av].StringValue] = color_array[av];
            }
        }
        g_allowed_colors.None = "#747474";
        g_allowed_colors[ "Not Done" ] = "#e0e0e0";
        dojo.empty(dojo.byId("chart_legend_row"));

        // put a legend on the page
        for (var c in g_allowed_colors) {
            if (g_allowed_colors.hasOwnProperty(c)) {
                var spacer = document.createElement("td");
                var value = document.createElement("td");

                spacer.innerHTML = "&nbsp;&nbsp;";
                spacer.style.backgroundColor = g_allowed_colors[ c ] || "#eeeeee";

                value.innerHTML = c;
                dojo.place(spacer, dojo.byId("chart_legend_row"), "last");
                dojo.place(value, dojo.byId("chart_legend_row"), "last");
            }
        }
        return;
    };
}