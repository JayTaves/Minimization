var arrToCSV, download, Patient, Group, generateVariates, categories, patients,
    study, Trial, runSet, isPatientOne, countPatientOne, distToExcel;

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

    this.shallowAdd = function (pat) {
        var i, arr;

        arr = [];

        for (i = 0; i < this.properties.length; i++) {
            arr[i] = this.properties[i] + pat.properties[i];
        }

        return arr;
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

    this.exponent = 1;

    this.groupDiff = function (a, b, exponent) {
        var diff, index;

        if (a.length !== b.length) {
            console.error("incompatible groups");
        }

        diff = 0;

        for (index = 0; index < a.length; index++) {
            diff += Math.pow(Math.abs(a[index] - b[index]), exponent);
        }

        return diff;
    };

    this.minimize = function (control, treatment, exponent, patient) {
        var newControl, newTreatment, controlDiff, treatmentDiff, diff, res, tb;

        newControl = control.shallowAdd(patient);
        newTreatment = treatment.shallowAdd(patient);

        controlDiff = this.groupDiff(newControl, treatment.properties, exponent);
        treatmentDiff = this.groupDiff(newTreatment, control.properties, exponent);

        diff = treatmentDiff - controlDiff;

        tb = false;
        if (treatmentDiff > controlDiff) {
            res = "control";
        } else if (controlDiff > treatmentDiff) {
            res = "treatment";
        } else {
            // Whatever calls minimize handles the tiebreak depending on settings
            res = "tie";
            tb = true;
        }

        return {
            res : res,
            ad : diff,
            tb : tb
        };
    };

    this.addPatient = function (patient) {
        var result;

        result = this.minimize(this.control, this.treatment, this.exponent, patient);

        if (result.tb) {
            if (Math.floor(Math.random() * 2) === 0) {
                this.control.addPatient(patient);
            } else {
                this.treatment.addPatient(patient);
            }
        } else {
            // Sorted directly to either treatment or control
            if (result.res === "treatment") {
                this.treatment.addPatient(patient);
            } else {
                this.control.addPatient(patient);
            }
        }
    };
};

runSet = function (numPats) {
    var index, pat;

    categories = generateVariates(7, 3, [2, 3, 2],
        ["Male", "Female", "Young", "Middle", "Old", "Low", "High"],
        ["Gender", "Age", "Risk"]);

    patients = [];

    for (index = 0; index < numPats; index++) {
        pat = new Patient(index, categories);
        pat.generateProperties();

        if (isPatientOne(pat) || isPatientTwo(pat) || isPatientThree(pat)) {
            patients.push(pat);
        } else {
            index--;
        }
    }

    study = new Trial(categories);

    for (index = 0; index < patients.length; index++) {
        study.addPatient(patients[index]);
    }

    return study;
};

objCopy = function (obj) {
    var newObj, prop;

    newObj = {};

    for (prop in obj) {
        newObj[prop] = obj[prop];
    }


};

distToExcel = function (n, its) {
    var arr, dist, i, res, exp;

    arr = [];
    dist = [];
    exp = [];

    for (i = 0; i < its; i++) {
        res = runSet(n);

        arr.push(countPatientOne(res.treatment) - countPatientOne(res.control));
        if (i % 10 === 0) {
            console.log(i);
        }
    }

    for (i = 0; i < arr.length; i++) {
        if (dist[arr[i]] === undefined) {
            dist[arr[i]] = 1;
        } else {
            dist[arr[i]]++;
        }
    }

    for (prop in dist) {
        exp.push([prop, dist[prop]]);
    }

    download("Distribution", arrToCSV(exp));

    return dist;
};

isPatientOne = function (patient) {
    var c;

    c = patient.properties;

    return c[0] === 1 && c[2] === 1 && c[5] === 1;
};

isPatientTwo = function (patient) {
    var c;

    c = patient.properties;

    return c[0] === 1 && c[2] === 1 && c[6] === 1;
};

isPatientThree = function (patient) {
    var c;

    c = patient.properties;

    return c[0] === 1 && c[3] === 1 && c[5] === 1;
};

countPatientOne = function (group) {
    var i, count;

    count = 0;

    for (i = 0; i < group.patients.length; i++) {
        if (isPatientOne(group.patients[i])) {
            count++;
        }
    }

    return count;
};

$(document).ready(function () {

});