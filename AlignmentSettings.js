// TODO: Make so this works externally!
AlignmentSettings = function(rallyDataSource, sizes, prefs) {
    rally.sdk.ComponentBase.call(this);

    var that = this;
    var accessors = [], deleteLinkConnections = [], otherSettings = [];
    var dialog, projectPrefRef, sizesObject;
    var validationDiv = dojo.byId("validationErrors");

    that.show = function() {
        if (dialog) {
            dialog.show();
        }
    };

    that.hide = function() {
        if (dialog) {
            dialog.hide();
        }
    };

    that._saveComplete = function() {
        window.location.reload();
    };

    that._getValues = function() {
        console.log( "_getValues" );
        var values = {fieldInfos:{}, otherSettings: {} };
        rally.forEach(accessors, function(value) {
            values.fieldInfos[value.field] = value.get();
        });
        return values;
    };

    that._storeValues = function(callback) {
        var pref;

        function errorCallback(results) {
            rally.Logger.warn(results);
        }

        if (!projectPrefRef) {
            pref = {
                Name: "PortfolioAlignment/Settings",
                Value: that._getValues(),
                Project:"/project/__PROJECT_OID__"
            };
            rallyDataSource.preferences.createAppPreference(pref, callback, errorCallback);
        } else {
            pref = {
                _ref : projectPrefRef,
                Value:that._getValues()
            };
            rallyDataSource.preferences.update(pref, callback, errorCallback);
        }
    };

    that.validateSizes = function() {
        var validationErrors = [];
        var total_allocation = 0;
        rally.forEach(accessors, function(value) {
            var ratio = dojo.trim( value.get().investmentCategory );
            if (ratio === "" || isNaN(ratio) || ratio < 0) {
                var investmentCategoryError = "Please enter a positive number for all your allocations.";
                if (validationErrors.indexOf(investmentCategoryError) === -1) {
                    validationErrors.push(investmentCategoryError);
                }
            } else {
                total_allocation += parseFloat( ratio, 10 );
            }
            if (!isNaN(ratio) && (ratio > 100 )) {
                var tooHighError = "Please enter an allocation that is less than or equal to 100% for each category";
                if (validationErrors.indexOf(tooHighError) === -1) {
                    validationErrors.push(tooHighError);
                }
            }
            if ( !isNaN(ratio) && ( parseFloat( ratio, 10 ) != parseInt( ratio, 10 ) ) ) {
                var tooManyDigitsError = "Please enter a whole number for each allocation.";
                if (validationErrors.indexOf(tooManyDigitsError) === -1) {
                    validationErrors.push(tooManyDigitsError);
                }
            }
        });
        if ( total_allocation != 100 ) {
            validationErrors.push( "Allocation assignments must add to exactly 100%" );
        }
        if (validationErrors.length > 0) {
            validationDiv.innerHTML = validationErrors.join("<br/>");
            dojo.removeClass(validationDiv, "hide");
        }
        return validationErrors.length === 0;
    };

    that._addControlToRow = function(row, divId, control, containerCss) {
        console.log( "_addControlToRow " );
        var td = document.createElement("td");
        var div = document.createElement("div");
        dojo.addClass(div, containerCss);
        td.appendChild(div);
        div.id = divId;
        if (divId.search(/labelString/) === -1) {
            control.display(div);
        } else {
            dojo.place(control, div);
        }
        row.appendChild(td);
    };

    that.deleteTableRow = function(fieldName) {
        dojo.byId(fieldName).parentNode.removeChild(dojo.byId(fieldName));  //remove size's form row
        dojo.forEach(accessors, function(value, i) {
            if (value && fieldName === value.field) {
                accessors.splice(i, 1); //remove size's object from accessors array
            }
        });
    };

    that._createTableRow = function(size) {
        var fieldName = size.investmentCategory;
        var row = document.createElement("tr");
        row.id = fieldName;

        //var labelTextBox = new rally.sdk.ui.basic.TextBox({rememberValue:false, value:fieldName});
        var labelString = document.createElement( "span" );
        labelString.innerHTML = fieldName;
        that._addControlToRow(row, fieldName + "-labelString", labelString, "labelTextBoxContainer");

        var investmentCategoryTextBox = new rally.sdk.ui.basic.TextBox({rememberValue:false, value:size.ratio });
        that._addControlToRow(row, fieldName + "-investmentCategoryTextBox", investmentCategoryTextBox, "investmentCategoryTextBoxContainer");

        var accessor = {
            field:fieldName,
            get: function() {
                var result = {};
                result.label = labelString.innerHTML;
                result.investmentCategory = investmentCategoryTextBox.getValue();
                return result;
            },
            set:function(object) {
                investmentCategoryTextBox.setValue(object.investmentCategory);
            }
        };
        accessors.push(accessor);
        return row;
    };

    that.restrictDialogHeight = function() {
        //restrict size of dialog to prevent scrolling issues when a field has A LOT of attributes
        dojo.query(".dijitDialog").forEach(function(node) {
            dojo.attr(node, "style", {
                "max-height": "550px",
                "overflow": "auto"
            });
        });
    };

    that.displaySaveCancelFeatures = function() {
        var buttonContainer = dojo.query(".buttonContainer")[0];

        var saveButton = new rally.sdk.ui.basic.Button({text:"Save", value:"Save"});
        saveButton.display(buttonContainer, function() {
            if (that.validateSizes()) {
                that._storeValues(that._saveComplete);
            }
        });

        var cancelLink = "<a href='' id='cancelLink'>Cancel</a>";
        dojo.place(cancelLink, buttonContainer);
        dojo.connect(dojo.byId('cancelLink'), "onclick", function(event) {
            dojo.addClass(validationDiv, "hide");
            dialog.hide();
            dojo.stopEvent(event);
        });

    };

    that.getValidEvents = function() {
        return {onHide:"onHide"};
    };

    that.displayDialog = function() {
        if (dialog) {
            return;
        }

        dojo.byId("settingsDialogDiv").style.visibility = "visible";

        dialog = new rally.sdk.ui.basic.Dialog({
            id : new Date().toString(),
            title: "Configure Settings for Target",
            draggable:false,
            closable:false,
            content: dojo.byId("settingsDialogDiv")
        });
        dialog.addEventListener("onHide", function() {
            that.fireEvent(that.getValidEvents().onHide, {});
        });
        dojo.addClass(validationDiv, "hide");
        dialog.display();
        that.displaySaveCancelFeatures();

        that.restrictDialogHeight();
    };

    that.displayUnits = function() {
        dojo.byId("units").innerHTML = "(%)";
        that.displayDialog();
    };

    that._setPreferenceValues = function(values) {
        console.log( "_setPreferenceValues" );
        sizesObject = {};
        rally.forEach(values.fieldInfos, function(size) {
            sizesObject[size.label] = {ratio: size.investmentCategory, investmentCategory: size.label};
        });
    };

    that._setDefaultValues = function() {
        console.log( "this._setDefaultValues" );
        sizesObject = {};
        rally.forEach(sizes, function(sizeValue, sizeKey) {
            sizesObject[sizeKey] = {ratio: sizeValue, investmentCategory: sizeKey};
        });
    };

    that._retrievePreferences = function(/*function*/callback) {
        console.log( "retrievePreferences");
        var projectPref;
        if (prefs && prefs.length) {
            dojo.forEach(prefs, function(p) {
                if (p.Project) {
                    //projectOid is a string need both strings to compare.
                    var projectRef = rally.sdk.util.Ref.getOidFromRef(p.Project) + "";

                    if (projectRef == __PROJECT_OID__ ) {
                        projectPref = p;
                        projectPrefRef = projectPref._ref;
                    }
                }
            });
            if (projectPref) {
                that._setPreferenceValues(projectPref.Value);
                callback({projectName:projectPref.Project._refObjectName});
            }
        } else {
            that._setDefaultValues();
            callback({});
        }
    };

    that._numericSort = function(o1, o2) {
        var key1 = parseFloat(o1.investmentCategory);
        var key2 = parseFloat(o2.investmentCategory);

        if (key1 === key2) {
            return 0;
        }

        return key1 < key2 ? -1 : 1;
    };

    that.display = function() {
        function createForm() {
            console.log( "createForm" );
            accessors = [];
            var rowArr = [];

            //to ensure correct order, we push objects into an array and then apply a custom numeric sort
            rally.forEach(sizesObject, function(size1) {
                rowArr.push(size1);
            });
            rowArr = rowArr.sort(that._numericSort);

            rally.forEach(rowArr, function(size2) {
                var row = that._createTableRow(size2);
                dojo.byId("settingsTableBody").appendChild(row);
            });
            that.displayUnits();
        }
        that._retrievePreferences(createForm);
    };
};