var arrToCSV, download, Patient, Group, generateVariates, categories, patients,
    study, Trial;

arrToCSV = function (arrs) {
    var csv = "";

    for (var i = 0; i < arrs.length; i++) {
        for (var j = 0; j < arrs[i].length; j++) {
            csv += '"' + arrs[i][j].toString() + '",';
        }
        csv = csv.substr(0, csv.length - 1) + "\n";
    }

    return csv;
};

download = function(filename, text) {
    // http://stackoverflow.com/a/18197341
    var element = document.createElement('a');

    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename + ".csv");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
};

generateVariates = function (numVariates, numCategories, distribution, varNames, catNames) {
    var variates, index, categories, catLength, len, cat, count, currentCat;

    variates = [];
    categories = [];

    catLength = Math.ceil(numVariates / numCategories);

    // Make sure distribution matches numVariates
    if (distribution !== undefined) {
        if (distribution.length !== numCategories) {
            console.error("Distribution had length " + distribution.length +
                " but the number of categories was specified as " + numCategories);
        }

        count = 0;

        for (index = 0; index < distribution.length; index++) {
            count += distribution[index];
        }

        if (count !== numVariates) {
            console.error("Distribution had " + count + " variates but numVariates set to " +
                numVariates);
        }
    }

    for (index = 0; index < numCategories; index++) {
        if (distribution === undefined) {
            len = index === numCategories - 1 ?
                numVariates - catLength * (numCategories - 1) : catLength;
        } else {
            len = distribution[index];
        }

        categories[index] = {
            name : catNames[index] === undefined ? "Category " + index : catNames[index],
            length : len,
            variates : []
        };
    }

    // Keeps track of which category we are on
    currentCat = 0;

    for (index = 0; index < numVariates; index++) {
        if (distribution === undefined) {
            cat = categories[Math.floor(index / catLength)];
        } else {
            distribution[0]--;
            cat = categories[currentCat];

            if (distribution[0] === 0) {
                currentCat++;
                distribution = distribution.reverse();
                distribution.pop();
                distribution = distribution.reverse();
            }
        }

        variates[index] = {
            id : index,
            name : varNames[index] === undefined ? "Variate " + index : varNames[index],
            count : 0,
            category : cat
        };

        cat.variates.push(variates[index]);
    }

    return {
        categories : categories,
        variates : variates
    };
};

Patient = function (id, categories) {
    this.id = id;
    this.categories = categories.categories;
    this.variates = categories.variates;

    this.properties = [];

    this.generateProperties = function () {
        var index, cat, variate;

        for (index = 0; index < this.categories.length; index++) {
            cat = this.categories[index];

            variate = cat.variates[Math.floor(Math.random() * cat.length)];
            this.properties[variate.id] = 1;
        }

        for (index = 0; index < this.variates.length; index++) {
            if (this.properties[index] === undefined) {
                this.properties[index] = 0;
            }
        }
    };

    this.printProperties = function () {
        var index, str, cat, variate;

        str = "";

        for (index = 0; index < this.properties.length; index++) {
            if (this.properties[index] === 1) {
                variate = this.variates[index];
                cat = variate.category;

                str += cat.name + ": " + variate.name + ", ";
            }
        }

        str = str.substring(0, str.length - 1);

        return str;
    };
};

Group = function (name, categories) {

    this.name = name;
    this.patients = [];

    this.properties = (function () {
        var index, variates;

        variates = [];

        for (index = 0; index < categories.variates.length; index++) {
            variates[index] = 0;
        }

        return variates;
    })();

    this.addPatient = function (pat) {
        var index;

        this.patients.push(pat);
        for (index = 0; index < this.properties.length; index++) {
            this.properties[index] += pat.properties[index];
        }
    };

    this.printProperties = function () {
        var index, str;

        str = "";
        for (index = 0; index < this.properties.length; index++) {
            str += categories.variates[index].name + ": " +
                this.properties[index] + ", ";
        }

        str = str.substring(0, str.length - 1);

        return str;
    }
};

Trial = function (categories) {
    this.control = new Group("Control", categories);
    this.treatment = new Group("Treatment", categories);

    this.groupDiff = function (a, b, exponent) {
        var diff, index;

        if (a.properties.length !== b.properties.length) {
            console.error("incompatible groups");
        }

        diff = 0;

        for (index = 0; index < a.properties.length; index++) {
            diff += Math.pow(Math.abs(a.properties[index] - b.properties[index]),
                exponent);
        }

        return diff;
    };

    this.minimize = function (control, treatment, exponent, patient) {
        var newControl, newTreatment, controlDiff, treatmentDiff, diff, res,
            finalControl, finalTreatment, tb;

        newControl = jQuery.extend(true, {}, control);
        newTreatment = jQuery.extend(true, {}, treatment);

        newControl.addPatient(patient);
        newTreatment.addPatient(patient);

        controlDiff = this.groupDiff(newControl, treatment, exponent);
        treatmentDiff = this.groupDiff(newTreatment, control, exponent);

        diff = treatmentDiff - controlDiff;

        tb = false;
        if (treatmentDiff > controlDiff) {
            res = "control";
            finalControl = newControl;
            finalTreatment = treatment;
        } else if (controlDiff > treatmentDiff) {
            res = "treatment";
            finalControl = control;
            finalTreatment = newTreatment;
        } else {
            // Whatever calls minimize handles the tiebreak depending on settings
            res = "tie";
            finalControl = newControl;
            finalTreatment = newTreatment;
            tb = true;
        }

        return {
            res : res,
            control : finalControl,
            treatment : finalTreatment,
            ad : diff,
            tb : tb
        };
    };
};

$(document).ready(function () {
    var index, pat;

    categories = generateVariates(7, 3, [2, 3, 2],
        ["Male", "Female", "Young", "Middle", "Old", "Low", "High"],
        ["Gender", "Age", "Risk"]);

    patients = [];

    for (index = 0; index < 100; index++) {
        pat = new Patient(index, categories);
        pat.generateProperties();

        patients.push(pat);
    }

    study = new Trial(categories);

    for (index = 0; index < patients.length; index++) {
        if (index % 2 === 0) {
            study.control.addPatient(patients[index]);
        } else {
            study.treatment.addPatient(patients[index]);
        }
    }

    console.log(study.control.printProperties());
    console.log(study.treatment.printProperties());

    console.log(study.groupDiff(study.control, study.treatment, 1));
});