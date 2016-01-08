var study, settings, newSettings, validateSettings;

settings = {
    numGators : 1,
    gators : [],

    allowedLength : 1,
    heldTurns : 4,
    playerView : "full",
    autoPlay : false,
    minimizeInvestigator : false,
    minimizeLength : false,
    tiebreakInvestigator : true,
    tiebreakSequence : {},
    minimizationExponent : 1,
    queueLength : 1,
    exportExcel : false,

    studyLength : 1,
    patients : [],
    patStr : "",

    // 1 : order, 2 : predetermined, 3 : n-block, 4 : alternate
    gatorStreamType : 1,
    blocksize : 1,
    gatorSeq : [],
};

var extraInfoRow = function (cellEntry) {
    return "<td>" + cellEntry + "</td>";
};

var extraInfoString = function (arr, header) {
    var tableString, index;

    tableString = "<tr><td>" + header + "</td>";

    for (index = 0; index < arr.length; index++) {
        tableString += extraInfoRow(arr[index]);
    }
    tableString += "</tr>";

    return tableString;
};

var Patient = function (number, gender, age, risk) {
    if (isNaN(number)) {
        var patient = number;
        this.number = patient.number;
        this.gender = patient.gender;
        this.age = patient.age;
        this.risk = patient.risk;
        this.investigator = patient.investigator;
        this.tag = patient.tag;
    } else {
        this.number = number;
        this.gender = gender;
        this.age = age;
        this.risk = risk;
        this.investigator = undefined;
        this.tag = "";
    }
};

var Investigator = function (number, strategy, strategyName, patient, group) {
    this.number = number;
    this.takeTurn = strategy;
    this.strategyName = strategyName;
    this.heldPatients = [];
    this.targetScore = 0;
    this.nonTargetScore = 0;
    this.targetsGiven = 0;
    this.selectPatient = patient;
    this.targetGroup = group;
    this.tagdex = 0;

    this.control = new Group("Investigator " + number + " control");
    this.treatment = new Group("Investigator " + number + " treatment");

    this.getTag = function () {
        var alphabet = "abcdefghijklmnopqrstuvwxyz";
        return alphabet[this.tagdex++ % alphabet.length];
    };

    this.holdPatient = function (heldPatient) {
        if (study.s.heldTurns === 0) {
            writeMessage(this.number, heldPatient, "discard");
        } else {
            this.heldPatients.push({
                patient: heldPatient,
                turns: study.s.heldTurns
            });
            writeMessage(this.number, heldPatient, "hold");
        }
    };

    this.heldCounter = function () {
        for (var index = this.heldPatients.length - 1; index >= 0; index--) {
            var heldPatient = this.heldPatients[index];
            if (heldPatient.turns === 0) {
                writeMessage(this.number, heldPatient.patient, "timeout");
                this.heldPatients.splice(index, 1);
            } else {
                heldPatient.turns--;
            }
        }
    };
};

var Gender = {
    Male: {value: 1, text: "Male"},
    Female: { value: 1, text: "Female" }
};

var AgeBuckets = {
    Young: {value: 1, text: "Young"},
    Middle: {value: 1, text: "Middle"},
    Old: { value: 1, text: "Old" }
};

var Risk = {
    Low: { value: 1, text: "Low" },
    High: { value: 1, text: "High" }
};

var Group = function (name, table, numInvestigators) {
    this.name = name;
    this.patients = [];
    this.title = $("tr.title." + name.toLowerCase());
    this.table = $(".table." + name.toLowerCase());

    if (table !== undefined) {
        this.patientsElem = table.siblings("table.totaltable").find("td.total.table");
    }
    this.investigators = [];

    for (var index = 0; index < numInvestigators; index++) {
        this.investigators[index] = {
            count: 0,
            elem: this.table.children(".i" + index)
        };
    }

    this.characteristics = {
        Male: {count: 0, elem: this.table.children(".male")},
        Female: {count: 0, elem: this.table.children(".female")},
        Young: {count: 0, elem: this.table.children(".young")},
        Middle: {count: 0, elem: this.table.children(".middle")},
        Old: {count: 0, elem: this.table.children(".old")},
        Low: {count: 0, elem: this.table.children(".low")},
        High: { count: 0, elem: this.table.children(".high")}
    };

    this.addPatient = function (patient) {
        this.patients.push(patient);
        this.characteristics[patient.gender.text].count += 1;
        this.characteristics[patient.age.text].count += 1;
        this.characteristics[patient.risk.text].count += 1;
        this.investigators[patient.investigator - 1].count += 1;
        return this;
    };

    this.updateTable = function () {
        for (var characteristic in this.characteristics) {
            var char = this.characteristics[characteristic];
            char.elem.text(char.count);
        }
        this.patientsElem.text(this.patients.length);
        if (study.s.minimizeInvestigator) {
            for (var index = 0; index < this.investigators.length; index++) {
                var current = this.investigators[index];
                current.elem.text(current.count);
            }
        }
    };
};

var Trial = function (investigators, doOutput, settings) {

    this.numInvestigators = investigators.length;

    this.s = settings;
    this.stats = {
        diffTally : []
    };

    if (this.s.minimizeInvestigator) {
        for (var index = 0; index < this.numInvestigators; index++) {
            $("tr.title").append("<td>Investigator " + (index + 1) + "</td>");
            $("tr.table").append("<td class='i" + index + "'></td>");
        }
    } else {
        $("tr.header td.gator").hide();
    }

    this.endGame = doOutput ?
        endGame :
        function (investigators, patients, control, treatment) {
            console.log("Study Ended");
            console.log(control);
            console.log(treatment);
        };

    $("tr.header .gator").prop("colspan", this.numInvestigators);
    $("tr.table").children("td").text("0");

    this.control = new Group("Control", $("#control table.maintable"), this.numInvestigators);
    this.treatment = new Group("Treatment", $("#treatment table.maintable"), this.numInvestigators);
    this.queue = [];

    /* current keeps track of the current balance of patient assignments, it is
        given by '# to treatment - # to control'. The two arrays keep track of
        the frequency of any given count, control holds the negative numbers and
        zero, treatment holds the positive numbers, streak.treatment[0] = 0 always
    */
    this.streak = {
        freq : [],
        current : 0
    };

    // Used for keeping data to put into the csv file
    this.exportArr = [];
    this.assignmentNo = 1;

    this.addPatient = function (patient, investigator) {
        var trialClosure, pushToGroup, patient1, patient2, c1, t2, c3, t3, c4, t4,
            diff1, diff2, diff3, diff4, diffMin, investigator1, investigator2, temp1, temp2, res1, res2, rawDiff;

        patient.investigator = investigator.number;
        trialClosure = this;

        this.queue.push({
            pat : patient,
            gator : investigator
        });

        // Minimizes and adds a patient to one of the two groups. Used in only one branch
        pushToGroup = function (patient) {
            var result, tie, groupRes, tiestr, tchars, cchars;

            result = minimize(patient, investigator, trialClosure.control,
                trialClosure.treatment, trialClosure);

            if (result.res === "control") {
                trialClosure.control = result.control;

                if (doOutput) {
                    if (result.tb) {
                        writeMessage(patient.investigator, patient, "add", "itiecontrol");
                    } else {
                        writeMessage(patient.investigator, patient, "add", "control");
                    }
                    trialClosure.control.updateTable();
                }

                groupRes = "control";
            } else if (result.res === "treatment") {
                trialClosure.treatment = result.treatment;

                if (doOutput) {
                    if (result.tb) {
                        writeMessage(patient.investigator, patient, "add", "itietreatment");
                    } else {
                        writeMessage(patient.investigator, patient, "add", "treatment");
                    }

                    trialClosure.treatment.updateTable();
                }

                groupRes = "treatment";
            } else if (result.res === "tie") {
                tie = trialClosure.tb.pop();
                tiestr = tie === -1 ? "control" : "treatment";
                trialClosure[tiestr] = result[tiestr];

                if (doOutput) {
                    writeMessage(patient.investigator, patient, "add", "tie" + tiestr);
                    trialClosure[tiestr].updateTable();
                }

                groupRes = tiestr;

            } else {
                console.error("Unreachable branch reached");
            }

            if (patient.number === investigator.selectPatient) {
                if (investigator.targetGroup.toLowerCase() === groupRes) {
                    investigator.targetScore++;
                } else {
                    investigator.nonTargetScore++;
                }
            }
            return groupRes;
        };

        /*  c1 [1, 2]       c2 []           c3 [2]      c4 [1]
            t1 []           t2 [1, 2]       t3 [1]      t4 [2]
        */
        if (this.queue.length === study.s.queueLength && study.s.queueLength === 2) {
            temp1 = this.queue.pop();
            temp2 = this.queue.pop();

            patient1 = temp1.pat;
            patient2 = temp2.pat;

            investigator1 = temp1.gator;
            investigator2 = temp2.gator;

            c3 = jQuery.extend(true, {}, this.control);
            c3.addPatient(patient2);

            t3 = jQuery.extend(true, {}, this.treatment);
            t3.addPatient(patient1);

            c4 = jQuery.extend(true, {}, this.control);
            c4.addPatient(patient1);

            t4 = jQuery.extend(true, {}, this.treatment);
            t4.addPatient(patient2);

            t2 = jQuery.extend(true, {}, t4);
            t2.addPatient(patient1);

            c1 = jQuery.extend(true, {}, c3);
            c1.addPatient(patient1);

            diff1 = groupDiff(c1, this.treatment, this.s.minimizeInvestigator);
            diff2 = groupDiff(this.control, t2, this.s.minimizeInvestigator);
            diff3 = groupDiff(c3, t3, this.s.minimizeInvestigator);
            diff4 = groupDiff(c4, t4, this.s.minimizeInvestigator);

            diffMin = Math.min(diff1, diff2, diff3, diff4);

            if (diff1 === diffMin) {
                this.control = c1;

                writeMessage(investigator2.number, patient2, "add", "control");
                writeMessage(investigator1.number, patient1, "add", "control");

                res1 = "control";
                res2 = "control";
            } else if (diff2 === diffMin) {
                this.treatment = t2;

                writeMessage(investigator2.number, patient2, "add", "treatment");
                writeMessage(investigator1.number, patient1, "add", "treatment");

                res1 = "treatment";
                res2 = "treatment";
            } else if (diff3 === diffMin) {
                this.control = c3;
                this.treatment = t3;

                writeMessage(investigator2.number, patient2, "add", "control");
                writeMessage(investigator1.number, patient1, "add", "treatment");

                res1 = "treatment";
                res2 = "control";
            } else if (diff4 === diffMin) {
                this.control = c4;
                this.treatment = t4;

                writeMessage(investigator2.number, patient2, "add", "treatment");
                writeMessage(investigator1.number, patient1, "add", "control");

                res1 = "control";
                res2 = "treatment";
            } else {
                throw "Minimum error";
            }

            if (investigator1.selectPatient === patient1.number) {
                if (investigator1.targetGroup === res1) {
                    investigator1.targetScore++;
                } else {
                    investigator1.nonTargetScore++;
                }
            }
            if (investigator2.selectPatient === patient2.number) {
                if (investigator2.targetGroup === res2) {
                    investigator2.targetScore++;
                } else {
                    investigator2.nonTargetScore++;
                }
            }

            this.control.updateTable();
            this.treatment.updateTable();
        } else if (this.queue.length === study.s.queueLength && study.s.queueLength === 1) {
            rawDiff = minimize(patient, investigator.number, this.control, this.treatment).ad;
            study.stats.diffTally.push(rawDiff);

            pushToGroup(this.queue.pop().pat);
        } else {

        }

        this.streak.current = this.treatment.patients.length - this.control.patients.length;

        if (this.streak.freq[this.streak.current] === undefined) {
            this.streak.freq[this.streak.current] = 1;
        } else {
            this.streak.freq[this.streak.current]++;
        }
    };
};

/* Computes the difference between two groups, with or without taking into
account investigators */
var groupDiff = function (controlGroup, treatmentGroup, useInvestigator, useLength) {
    var comparison, diff;

    comparison = {};

    for (var prop in controlGroup.characteristics) {
        comparison[prop] = Math.pow(Math.abs(controlGroup.characteristics[prop].count - treatmentGroup.characteristics[prop].count), study.s.minimizationExponent);
    }

    if (useInvestigator) {
        for (var index = 0; index < controlGroup.investigators.length; index++) {
            comparison["i" + index] = Math.pow(Math.abs(controlGroup.investigators[index].count - treatmentGroup.investigators[index].count), study.s.minimizationExponent);
        }
    }

    if (useLength) {
        comparison.subjects = Math.pow(Math.abs(controlGroup.patients.length -
            treatmentGroup.patients.length), study.s.minimizationExponent);
    }

    diff = 0;

    for (prop in comparison) {
        diff += comparison[prop];
    }

    return diff;
};

var minimize = function (patient, investigator, control, treatment, trial) {
    var addDiff, newControlTest, newTreatmentTest, controlDiff, treatmentDiff,
        controlTieDiff, treatmentTieDiff, ntchar, ncchar, nchar, cchar;

    newControlTest = jQuery.extend(true, {}, control);
    newTreatmentTest = jQuery.extend(true, {}, treatment);

    newControlTest.addPatient(patient, investigator);
    newTreatmentTest.addPatient(patient, investigator);

    controlDiff = groupDiff(newControlTest, treatment,
        study.s.minimizeInvestigator, study.s.minimizeLength);
    treatmentDiff = groupDiff(newTreatmentTest, control,
        study.s.minimizeInvestigator, study.s.minimizeLength);

    addDiff = treatmentDiff - controlDiff;

    ntchar = newTreatmentTest.characteristics;
    ncchar = newControlTest.characteristics;

    if (trial !== undefined && trial.s.exportExcel) {
        trial.exportArr.push(["assign #", "inv", "pt", "rx",
            "Trial"]);

        tchars = treatment.characteristics;
        cchars = control.characteristics;

        trial.exportArr.push(["", "", "", "", "T", tchars.Male.count,
            tchars.Female.count, tchars.Young.count, tchars.Middle.count,
            tchars.Old.count, tchars.Low.count, tchars.High.count,
            "", "diff score"]);

        trial.exportArr.push([trial.assignmentNo,
            investigator.number, patient.number,
            treatmentDiff > controlDiff ? -1 : 1, "",
            patient.gender.text === "Male" ? 1 : "",
            patient.gender.text === "Female" ? 1 : "",
            patient.age.text === "Young" ? 1 : "",
            patient.age.text === "Middle" ? 1 : "",
            patient.age.text === "Old" ? 1 : "",
            patient.risk.text === "Low" ? 1 : "",
            patient.risk.text === "High" ? 1 : ""]);

        trial.exportArr.push(["", "", "", "", "T+", ntchar.Male.count,
            ntchar.Female.count, ntchar.Young.count, ntchar.Middle.count,
            ntchar.Old.count, ntchar.Low.count, ntchar.High.count]);

        trial.exportArr.push([""]);
        trial.exportArr.push([""]);

        trial.exportArr.push(["", "", "", "", "C", cchars.Male.count,
            cchars.Female.count, cchars.Young.count, cchars.Middle.count,
            cchars.Old.count, cchars.Low.count, cchars.High.count]);

        trial.exportArr.push([trial.assignmentNo,
            investigator.number, patient.number,
            treatmentDiff > controlDiff ? -1 : 1, "",
            patient.gender.text === "Male" ? 1 : "",
            patient.gender.text === "Female" ? 1 : "",
            patient.age.text === "Young" ? 1 : "",
            patient.age.text === "Middle" ? 1 : "",
            patient.age.text === "Old" ? 1 : "",
            patient.risk.text === "Low" ? 1 : "",
            patient.risk.text === "High" ? 1 : ""]);

        trial.exportArr.push(["", "", "", "", "C+", ncchar.Male.count,
            ncchar.Female.count, ncchar.Young.count, ncchar.Middle.count,
            ncchar.Old.count, ncchar.Low.count, ncchar.High.count]);

        trial.exportArr.push([""]);

        trial.exportArr.push(["", "", "", "abs diff T+, C", "",
            Math.abs(ntchar.Male.count - cchars.Male.count),
            Math.abs(ntchar.Female.count - cchars.Female.count),
            Math.abs(ntchar.Young.count - cchars.Young.count),
            Math.abs(ntchar.Middle.count - cchars.Middle.count),
            Math.abs(ntchar.Old.count - cchars.Old.count),
            Math.abs(ntchar.Low.count - cchars.Low.count),
            Math.abs(ntchar.High.count - cchars.High.count)
            ]);

        trial.exportArr.push(["", "", "", "abs diff C+, T", "",
            Math.abs(ncchar.Male.count - tchars.Male.count),
            Math.abs(ncchar.Female.count - tchars.Female.count),
            Math.abs(ncchar.Young.count - tchars.Young.count),
            Math.abs(ncchar.Middle.count - tchars.Middle.count),
            Math.abs(ncchar.Old.count - tchars.Old.count),
            Math.abs(ncchar.Low.count - tchars.Low.count),
            Math.abs(ncchar.High.count - tchars.High.count),
            addDiff, addDiff > 0 ? "C" : (addDiff === 0 ? "Tie" : "T")
            ]);

        trial.exportArr.push([""]);
        trial.exportArr.push([""]);

        trial.assignmentNo++;
    }

    if (treatmentDiff > controlDiff) {
        return {
            res: "control",
            control: newControlTest,
            treatment: treatment,
            ad: addDiff,
            tb: false
        };
    } else if (treatmentDiff < controlDiff) {
        return {
            res: "treatment",
            control: control,
            treatment: newTreatmentTest,
            ad: addDiff,
            tb: false
        };
    } else {
        if (!study.s.minimizeInvestigator && study.s.tiebreakInvestigator) {
            controlTieDiff = groupDiff(newControlTest, treatment, true);
            treatmentTieDiff = groupDiff(newTreatmentTest, control, true);

            if (treatmentTieDiff > controlTieDiff) {
                return {
                    res: "control",
                    control: newControlTest,
                    treatment: treatment,
                    ad: addDiff,
                    tb: true
                }
            } else if (treatmentTieDiff < controlTieDiff) {
                return {
                    res: "treatment",
                    control: control,
                    treatment: newTreatmentTest,
                    ad: addDiff,
                    tb: true
                }
            }
        }

        return {
            res: "tie",
            control: newControlTest,
            treatment: newTreatmentTest,
            ad: addDiff,
            tb: true
        };
    }
};

var nextPatient = function (patient, table) {
    this.patient = patient;

    this.Male = {elem: table.children(".male")},
    this.Female = {elem: table.children(".female")},
    this.Young = {elem: table.children(".young")},
    this.Middle = {elem: table.children(".middle")},
    this.Old = {elem: table.children(".old")},
    this.Low = {elem: table.children(".low")},
    this.High = {elem: table.children(".high")},

    this.updateTable = function () {
        $("a#patientnumber").text("").text(this.patient.number);
        $("tr.patient.table").children().text("0");
        this[this.patient.gender.text].elem.text("1");
        this[this.patient.age.text].elem.text("1");
        this[this.patient.risk.text].elem.text("1");
        $("tr.patient.table").children(".i" + (this.patient.investigator - 1)).text("1");
    };
};

//All possible types of patients
var one = new Patient(1, Gender.Male, AgeBuckets.Young, Risk.Low);
var two = new Patient(2, Gender.Male, AgeBuckets.Young, Risk.High);
var three = new Patient(3, Gender.Male, AgeBuckets.Middle, Risk.Low);
var four = new Patient(4, Gender.Male, AgeBuckets.Middle, Risk.High);
var five = new Patient(5, Gender.Male, AgeBuckets.Old, Risk.Low);
var six = new Patient(6, Gender.Male, AgeBuckets.Old, Risk.High);

var seven = new Patient(7, Gender.Female, AgeBuckets.Young, Risk.Low);
var eight = new Patient(8, Gender.Female, AgeBuckets.Young, Risk.High);
var nine = new Patient(9, Gender.Female, AgeBuckets.Middle, Risk.Low);
var ten = new Patient(10, Gender.Female, AgeBuckets.Middle, Risk.High);
var eleven = new Patient(11, Gender.Female, AgeBuckets.Old, Risk.Low);
var twelve = new Patient(12, Gender.Female, AgeBuckets.Old, Risk.High);

//Note calls to setup use the same name of allPatients, but do not refer to this array
var allPatients = [jQuery.extend(true, {}, one),
                    jQuery.extend(true, {}, two),
                    jQuery.extend(true, {}, three),
                    jQuery.extend(true, {}, four),
                    jQuery.extend(true, {}, five),
                    jQuery.extend(true, {}, six),
                    jQuery.extend(true, {}, seven),
                    jQuery.extend(true, {}, eight),
                    jQuery.extend(true, {}, nine),
                    jQuery.extend(true, {}, ten),
                    jQuery.extend(true, {}, eleven),
                    jQuery.extend(true, {}, twelve)];

//Strategies for investigators
var random = function (gatorNumber, study, count, allInvestigators, allPatients) {
    var diff;
    var patient = displayPatient(allInvestigators, allPatients, count, gatorNumber);
    var investigator = this;
    if (patient === undefined) {
        endGame(allInvestigators, allPatients);
    } else {
        if (study.s.autoPlay) {
            var res = study.addPatient(patient, investigator);
            if (investigator.selectPatient !== undefined && investigator.targetGroup !== undefined && patient.number === investigator.selectPatient) {
                investigator.targetsGiven++;
                patient.tag = investigator.getTag();
            }
            nextInvestigator(allInvestigators, allPatients, count, study);
        } else {
            $("button#next").click(function () {
                $("button#next").off("click");
                res = study.addPatient(patient, investigator);
                if (investigator.selectPatient !== undefined && investigator.targetGroup !== undefined && patient.number === investigator.selectPatient) {
                    investigator.targetsGiven++;
                }
                nextInvestigator(allInvestigators, allPatients, count, study);
            });
        }
    }
};
var cheat = function (gatorNumber, study, count, allInvestigators, allPatients) {
    var patient = displayPatient(allInvestigators, allPatients, count, gatorNumber);
    var investigator = this;

    var turn = function () {
        var result;

        tryHeld();

        if (patient.number === investigator.selectPatient) {
            patient.tag = investigator.getTag();
            investigator.targetsGiven++;

            result = minimize(patient, gatorNumber, study.control, study.treatment);

            if (result.res === investigator.targetGroup) {
                study.addPatient(patient, investigator);
            } else {
                investigator.holdPatient(patient);
            }
        } else {
            patientRes = study.addPatient(patient, investigator);
            tryHeld();
        }
        nextInvestigator(allInvestigators, allPatients, count, study);
    };

    var tryHeld = function () {
        for (var index = 0; index < investigator.heldPatients.length; index++) {
            var hpat = investigator.heldPatients[index].patient;
            var result = minimize(hpat, gatorNumber, study.control, study.treatment);
            if (result.res === investigator.targetGroup && hpat.number === investigator.selectPatient) {
                patientRes = study.addPatient(investigator.heldPatients.shift().patient, investigator);
                index--;
            }
        }
    };

    if (patient === undefined) {
        endGame(allInvestigators, allPatients);
    } else {
        if (study.s.autoPlay) {
            turn();
        } else {
            $("button#next").click(function () {
                $("button#next").off("click");
                turn();
            });
        }
    }
};
var player = function (gatorNumber, study, count, allInvestigators, allPatients) {
    var patient = displayPatient(allInvestigators, allPatients, count, gatorNumber);
    var investigator = this;
    var patientPlaced = false;
    var add = function () {
        var patientRes = study.addPatient(patient, investigator);
        patientPlaced = true;
        heldTable();
        $("button.actions").hide();
        $("span#allottedpatient").hide();
        $("button#playerendturn").show();
    };
    var hold = function () {
        investigator.holdPatient(patient);
        patientPlaced = true;
        heldTable();
        $("button.actions").hide();
        $("span#allottedpatient").hide();
        $("button#playerendturn").show();
    };
    var discard = function () {
        writeMessage(investigator.number, patient, "discard");
        patientPlaced = true;
        heldTable();
        $("button.actions").hide();
        $("span#allottedpatient").hide();
        $("button#playerendturn").show();
    };
    var endTurn = function () {
        $("div#playerturn").hide();
        $("button#next").show();
        //investigator.heldCounter();
        nextInvestigator(allInvestigators, allPatients, count, study);
    };
    var currentPatientPrediction = function () {
        var result = minimize(patient, gatorNumber, study.control, study.treatment);
        $("a.playergroup").text(result.res);
    };
    var heldTable = function () {
        $("button#playerhold").toggle(investigator.heldPatients.length !== study.s.allowedLength && !patientPlaced);
        if (investigator.heldPatients.length === 0) {
            $("table#gatorheldpatients").hide();
            $("a.playerheld").text("You are currently holding no patients.");
        } else {
            $("table#gatorheldpatients").show();
            $("a.playerheld").text("");
            //Both of these are higher-order functions to get around the stupid closure/for loop rules in the loop below
            //Maybe there is an easier way to solve this problem but I'm not aware of it
            //Writing function () { discardHeld(index); } as the callback will fail as index will refer to the most recent value
            //  stored in index, not the value it had at that loop iteration
            var discardHeld = function (number) {
                return function () {
                    $("button.discardheld, button.addheld").off("click");
                    var patient = investigator.heldPatients.splice(number, 1)[0].patient;
                    writeMessage(gatorNumber, patient, "discard");
                    currentPatientPrediction();
                    heldTable();
                };
            };
            var addHeld = function (number) {
                return function () {
                    $("button.discardheld, button.addheld").off("click");
                    var patient = investigator.heldPatients.splice(number, 1)[0].patient;
                    var patientRes = study.addPatient(patient, investigator);
                    currentPatientPrediction();
                    heldTable();
                };
            };
            $("table#gatorheldpatients").children("tbody").children().not("tr.heldtitle").remove();
            for (var index = 0; index < investigator.heldPatients.length; index++) {
                var heldPatient = investigator.heldPatients[index];
                $("<tr>" +
                    "<td>" + heldPatient.patient.number + "</td>" +
                    "<td>" + heldPatient.turns + "</td>" +
                    "<td>" + minimize(heldPatient.patient, gatorNumber, study.control, study.treatment).res + "</td>" +
                    "<td>" +
                        "<button class='discardheld " + index + "'>Discard</discard>" +
                    "</td>" +
                    "<td>" +
                        "<button class='addheld " + index + "'>Add</button>" +
                    "</td>" +
                "</tr>").insertAfter("tr.heldtitle");
                $("button.discardheld." + index).click(discardHeld(index));
                $("button.addheld." + index).click(addHeld(index));
            }
        }
    };
    if (patient === undefined) {
        endGame(allInvestigators, allPatients);
    } else {
        if (study.s.autoPlay && patient.number !== this.selectPatient) {
            add();
            endTurn();
        } else {
            if (patient.number === this.selectPatient) {
                patient.tag = investigator.getTag();
                investigator.targetsGiven++;
            }
            $("div#playerturn").show();
            $("button#next").hide();
            $("a.playergator").text(gatorNumber);
            $("a.playerpatient").text(patient.number);
            $("span#allottedpatient").show();
            $("button.player").show();
            $("button#playerendturn").hide();
            currentPatientPrediction();
            heldTable();
            if (study.s.heldTurns === 0) {
                $("button#playerhold").prop("disabled", true);
            } else {
                $("button#playerhold").on("click", function () {
                    $("button.actions").off("click");
                    hold();
                });
            }
            $("button#playeradd").on("click", function () {
                $("button.actions").off("click");
                add();
            });
            $("button#playerdiscard").on("click", function () {
                $("button.actions").off("click");
                discard();
            });
            $("button#playerendturn").on("click", function () {
                $("button.player").off("click");
                endTurn();
            });
        }
    }
};

var displayPatient = function (allInvestigators, allPatients, count, gatorNumber) {
    if (allPatients.length === 0) {
        $("button#next").hide();
        writeMessage(0, undefined, "end", "No more patients to sort. Study ended.");
        return undefined;
    } else {
        var currentPatient = allPatients.pop();
        currentPatient.investigator = gatorNumber;
        var next = new nextPatient(currentPatient, $("tr.patient.table"));
        next.updateTable();
        return currentPatient;
    }
}
var nextInvestigator = function (allInvestigators, allPatients, count, study) {
    var currentInvestigator;

    currentInvestigator = allInvestigators[study.s.gatorSeq[count]];

    for (var index = 0; index < allInvestigators.length; index++) {
        allInvestigators[index].heldCounter();
    }

    count++;

    if (currentInvestigator !== undefined) {
        currentInvestigator.takeTurn(currentInvestigator.number, study, count, allInvestigators, allPatients);
    } else {
        study.endGame(allInvestigators, allPatients);
    }
}
var endGame = function (allInvestigators, allPatients) {
    var index, investigator, str;

    for (index = 0; index < allInvestigators.length; index++) {
        investigator = allInvestigators[index];
        if (investigator.strategyName === "cheat" || investigator.strategyName === "random") {
            writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore, given: investigator.targetsGiven }, "score");
        } else if (investigator.strategyName === "player") {
            writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore, given: investigator.targetsGiven }, "score", "player");
        }
    }

    if (study.s.exportExcel) {
        str = prettyDate() + "_inv-" + study.s.numGators + "_pat-" +
            study.s.studyLength;

        download(str, arrToCSV(study.exportArr));
    }
    fillStatsTable();
}

prettyDate = function () {
    var today, dd, mm, yyyy, hh;

    today = new Date();
    dd = today.getDate();
    mm = today.getMonth() + 1; // Starts at 0
    yyyy = today.getFullYear();

    // pad with a zero
    dd = dd < 10 ? "0" + dd : dd;
    mm = mm < 10 ? "0" + mm : mm;

    return mm + "-" + dd + "-" + yyyy;
};

var writeMessage = function (gatorNum, patient, action, result) {
    var message, meanRes;
    if (gatorNum === 0) {
        if (action === "end") {
            message = "<a>" + result + "</a><br />";
        } else if (action === "diff") {
            meanRes = mean(study.stats.diffTally);
            message = "<a>Mean difference between the groups was " + meanRes.mean.toString().substr(0, 5) +
                            ", median difference between the groups was " + median(study.stats.diffTally) + "</a><br />" +
                "<a>Maximum difference was " + meanRes.max + ", minimum difference was " + meanRes.min + "</a><br />";
        }
    } else {
        if (action === "add") {
            message = "<a>Investigator " + gatorNum + " added patient " + patient.number + patient.tag + ".";
            if (result === "treatment") {
                message += " It was added to the treatment group.</a><br />";
            } else if (result === "control") {
                message += " It was added to the control group.</a><br />";
            } else if (result === "tiecontrol") {
                message += " After a tie break it was added to the control group.</a><br />";
            } else if (result === "tietreatment") {
                message += " After a tie break it was added to the treatment group.</a><br />";
            } else if (result === "itiecontrol") {
                message += " After an investigator tie break it was added to the control group.</a><br />";
            } else if (result === "itietreatment") {
                message += " After an investigator tie break it was added to the treatment group.</a><br />";
            } else {
                console.error("Invalid result");
            }
        } else if (action === "hold") {
            message = "<a>Investigator " + gatorNum + " held patient " + patient.number + patient.tag + ".</a><br />";
        } else if (action === "discard") {
            message = "<a>Investigator " + gatorNum + " discarded patient " + patient.number + patient.tag + " from the study.</a><br />";
        } else if (action === "timeout") {
            message = "<a>Investigator " + gatorNum + " discarded patient " + patient.number + patient.tag + " because it was held for too long.</a><br />";
        } else if (action === "score") {
            var points = patient.target;
            var nonPoints = patient.nonTarget;
            var given = patient.given;
            message = "<a>Investigator " + gatorNum;
            if (result === "player") {
                message += " (you)";
            }
            message += " was given " + given + " select patients, got " + points + " into their target group and " + nonPoints + " into the other group.</a><br />";
        } else {
            console.error("Invalid action");
        }
    }
    if (study.s.playerView === "full") {
        $("div#messages div").prepend(message);
    } else if (study.s.playerView === "partial") {
        if (action === "add") {
            $("div#messages div").prepend(message);
            //There are two elements with a message, <a> and <br /> so we divide the length by two and remove the last two.
            //Maching it to three, checks that there are already three messages there (we add the new message before removing the old one)
            if ($("div#messages div").children().length / 2 === 3) {
                $("div#messages div").children().slice(-2).remove();
            }
        } else if (action === "end" || action === "score") {
            $("div#messages div").prepend(message);
        }
    } else {
        console.error("Invalid setting");
    }
};
var validateSequence = function (sequence) {
    var re, pass;

    re = /^(\s)*(([1-9]|1[0-2]),(\s)*)*([1-9]|1[0-2])(\s)*$/;
    pass = re.test(sequence);

    $("i#ownseqvalid").show();

    if (pass) {
        $("i#ownseqvalid").attr("class", "fa fa-check");
    } else {
        $("i#ownseqvalid").attr("class", "fa fa-exclamation");
    }

    return pass;
};

var validateTieSequence = function (sequence) {
    var re, pass;

    re = /^(\s)*((-1|1),(\s)*)*(-1|1)(\s)*$/;
    pass = re.test(sequence);
    $("i#tiebreaksequencevalid").show();

    if (pass) {
        $("i#tiebreaksequencevalid").attr("class", "fa fa-check");
    } else {
        $("i#tiebreaksequencevalid").attr("class", "fa fa-exclamation");
    }

    return pass;
};

var validateGatorSequence = function (sequence) {
    var re, pass;

    re = /^((\s)*[1-9],(\s)*)*([1-9])(\s)*$/;
    pass = re.test(sequence);

    $("i#gatorsequencevalid").show();

    if (pass) {
        $("i#gatorsequencevalid").removeClass("fa-exclamation").addClass("fa-check");
    } else {
        $("i#gatorsequencevalid").removeClass("fa-check").addClass("fa-exclamation");
    }

    return pass;
};

var repeatStudy = function (parameters, investigators) {
    var study = new Trial(investigators, false);
    var count = 0;

    nextInvestigator(investigators, undefined /* patients */, count, study);

};

var setup = function (allInvestigators, studyPatients, tiebreakSequence) {
    study = new Trial(allInvestigators, true, settings);
    study.tb = tiebreakSequence.arr;

    $("#allsettings").val(JSON.stringify(study.s));

    var count = 0;

    $("div#studysetup").hide();
    $("div#study").show();
    $("div#patient").show();
    $("div#cards").show();
    $("div#playerturn").hide();
    $("button#next").show();
    $("button#next").on("click", function () {
        $("button#next").off("click");
        nextInvestigator(allInvestigators, studyPatients, count, study);
    });
};

var mean = function (arr) {
    var max, min, sum, index;

    min = Number.MAX_VALUE;
    max = -1 * min;
    sum = 0;
    for (index = 0; index < arr.length; index++) {
        sum = sum + arr[index];
        min = arr[index] < min ? arr[index] : min;
        max = arr[index] > max ? arr[index] : max;
    }
    return {
        min: min,
        max: max,
        mean: sum / arr.length
    };
};
var median = function (arr) {
    var compareFn, len;

    len = arr.length;
    compareFn = function (a, b) {
        return a - b;
    };

    arr = arr.sort(compareFn);
    if (len % 2 !== 0) {
        return arr[Math.floor(len / 2)];
    } else {
        return (arr[len / 2 - 1] + arr[len / 2]) / 2;
    }
};

var getAlternating = function (types, length) {
    var blocks, finalArr, forwardArr, backwardArr, blockArr, i, j;

    blocks = Math.ceil( length / (types * 2) );
    finalArr = [];
    forwardArr = [];
    backwardArr = [];

    for (j = types - 1; j >= 0; j--) {
        forwardArr.push(j);
        backwardArr.push(j);
    }

    blockArr = backwardArr.concat(forwardArr.reverse());

    for (i = 0; i < blocks; i++) {
        finalArr = finalArr.concat(blockArr);
    }

    return finalArr;
};

var getNBlock = function (types, length, n) {
    var i, pick, ndex, bag, startArr, iters, finalArr, iterSize;

    iterSize = n * types;
    iters = Math.ceil(length / iterSize);
    finalArr = [];

    for (bag = 0; bag < iters; bag++) {
        startArr = [];
        for (i = 0; i < types; i++) {
            for (ndex = 0; ndex < n; ndex++) {
                startArr.push(i);
            }
        }
        for (pick = 0; pick < iterSize; pick++) {
            finalArr.push(startArr.splice(Math.floor(Math.random() * iterSize - pick), 1)[0]);
        }
    }

    return finalArr;
};

var countStats = function (group, numGators) {
    var patsArr, index, pat, j;

    patsArr = [];
    for (index = 0; index < 12; index++) {
        patsArr[index] = [];
        for (j = 0; j < numGators; j++) {
            patsArr[index].push(0);
        }
    }

    for (index = 0; index < group.length; index++) {
        pat = group[index];

        patsArr[pat.number - 1][pat.investigator - 1]++;
    }

    return patsArr;
};

var fillStatsTable = function () {
    var c, t, cstr, tstr, index, mapFn, ccount, tcount, diff, sumPats, sumVars,
        streakArr, freqArr;

    c = countStats(study.control.patients, study.numInvestigators);
    t = countStats(study.treatment.patients, study.numInvestigators);

    cstr = "";
    tstr = "";
    ccount = [];
    tcount = [];

    mapFn = function (dex) {
        return function (elem) {
            return elem[dex];
        };
    };

    sumPats = function (currentValue) {
        var count, index;

        count = 0;
        for (index = 0; index < currentValue.length; index++) {
            count += currentValue[index];
        }

        return count;
    };

    ccount = c.map(sumPats);
    tcount = t.map(sumPats);
    diff = [];

    for (index = 0; index < ccount.length; index++) {
        diff[index] = tcount[index] - ccount[index];
    }

    // For variate table
    sumVars = {
        control: [],
        treatment: [],
        diff: []
    };

    // This is a pretty tedious and dumb way of tallying these counts
    // Males
    sumVars.control[0] = ccount[0] + ccount[1] + ccount[2] + ccount[3] + ccount[4] + ccount[5];
    sumVars.treatment[0] = tcount[0] + tcount[1] + tcount[2] + tcount[3] + tcount[4] + tcount[5];
    sumVars.diff[0] = sumVars.treatment[0] - sumVars.control[0];

    // Females
    sumVars.control[1] = study.control.patients.length - sumVars.control[0];
    sumVars.treatment[1] = study.treatment.patients.length - sumVars.treatment[0];
    sumVars.diff[1] = sumVars.treatment[1] - sumVars.control[1];

    // Young
    sumVars.control[2] = ccount[0] + ccount[1] + ccount[6] + ccount[7];
    sumVars.treatment[2] = tcount[0] + tcount[1] + tcount[6] + tcount[7];
    sumVars.diff[2] = sumVars.treatment[2] - sumVars.control[2];

    // Middle
    sumVars.control[3] = ccount[2] + ccount[3] + ccount[8] + ccount[9];
    sumVars.treatment[3] = tcount[2] + tcount[3] + tcount[8] + tcount[9];
    sumVars.diff[3] = sumVars.treatment[3] - sumVars.control[3];

    // Old
    sumVars.control[4] = study.control.patients.length - (sumVars.control[3] + sumVars.control[2]);
    sumVars.treatment[4] = study.treatment.patients.length - (sumVars.treatment[3] + sumVars.treatment[2]);
    sumVars.diff[4] = sumVars.treatment[4] - sumVars.control[4];

    // Low
    sumVars.control[5] = ccount[0] + ccount[2] + ccount[4] + ccount[6] + ccount[8] + ccount[10];
    sumVars.treatment[5] = tcount[0] + tcount[2] + tcount[4] + tcount[6] + tcount[8] + tcount[10];
    sumVars.diff[5] = sumVars.treatment[5] - sumVars.control[5];

    // High
    sumVars.control[6] = study.control.patients.length - sumVars.control[5];
    sumVars.treatment[6] = study.treatment.patients.length - sumVars.treatment[5];
    sumVars.diff[6] = sumVars.treatment[6] - sumVars.control[6];

    $("#variatebygroup").after(extraInfoString(sumVars.diff, "Difference"));
    $("#variatebygroup").after(extraInfoString(sumVars.control, "Control"));
    $("#variatebygroup").after(extraInfoString(sumVars.treatment, "Treatment"));

    $("#patbygrouphead").after(extraInfoString(diff, "Difference"));
    $("#patbygrouphead").after(extraInfoString(ccount, "Control"));
    $("#patbygrouphead").after(extraInfoString(tcount, "Treatment"));

    for (index = 0; index < study.numInvestigators; index++) {
        cstr += extraInfoString(c.map(mapFn(index)), index + 1);
        tstr += extraInfoString(t.map(mapFn(index)), index + 1);
    }

    // Streak frequency data
    streakArr = [];
    freqArr = [];

    index = study.streak.freq.length - 1;
    while (study.streak.freq[index] !== undefined) {
        streakArr.push(index);
        freqArr.push(study.streak.freq[index]);
        index--;
    }

    $("#streakfrequency").after(extraInfoString(streakArr, "Count"));
    $("#streakfrequency").after(extraInfoString(freqArr, "Frequency"));

    $("#controlhead").after(cstr);
    $("#treathead").after(tstr);
    $("#frequencydata").show();
};

var arrToCSV = function (arrs) {
    var csv = "";

    for (var i = 0; i < arrs.length; i++) {
        for (var j = 0; j < arrs[i].length; j++) {
            csv += '"' + arrs[i][j].toString() + '",';
        }
        csv = csv.substr(0, csv.length - 1) + "\n";
    }

    return csv;
};

function download(filename, text) {
    // http://stackoverflow.com/a/18197341
    var element = document.createElement('a');

    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename + ".csv");

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

validateSettings = function (str) {
    var s, testInt, testGator, testBoolean, index, tie, num;

    testInt = function (obj, prop, min, max) {
        // test if s[prop] is an int between the specified bounds
        if (obj[prop] !== parseInt(obj[prop], 10) || obj[prop] < min || obj[prop] > max) {
            throw {
                msg : "Error parsing " + prop + ", " + obj[prop] +
                    " is not a an integer or is less than " + min +
                    " or is greater than " + max,
                type : "SettingsValidate"
            };
        }
    };

    testGator = function (gator) {
        var strat, group;

        strat = gator.strategyName;
        group = gator.targetGroup;

        if (strat !== "player" && strat !== "random" && strat !== "cheat") {
            throw {
                msg : strat + " is not a valid investigator strategy",
                type : "SettingsValidate"
            };
        }

        if (group !== "control" && group !== "treatment") {
            throw {
                msg : group + " is not a valid target group",
                type : "SettingsValidate"
            };
        }

        testInt(gator, "selectPatient", 1, 12);
    };

    testBoolean = function (prop) {
        if (s[prop] !== false && s[prop] !== true) {
            throw {
                msg : prop + " is not a boolean",
                type : "SettingsValidate"
            };
        }
    };

    try {
        s = JSON.parse(str);
    } catch (e) {
        if (e instanceof SyntaxError) {
            throw {
                msg : "Parse Error",
                type : "SettingsValidate"
            };
        } else {
            throw e;
        }
    }

    testInt(s, "numGators", 1, 10);

    for (index = 0; index < s.gators.length; index++) {
        testGator(s.gators[index]);
    }

    testInt(s, "allowedLength", 1, 5);
    testInt(s, "heldTurns", 0, 5);

    if (s.playerView !== "full" && s.playerView !== "partial") {
        throw {
            msg : s.playerView + " is not a valid option",
            type : "SettingsValidate"
        };
    }

    testBoolean("autoPlay");
    testBoolean("minimizeInvestigator");
    testBoolean("tiebreakInvestigator");

    // Note there is no check on tiebreakSequence.str
    for (index = 0; index < s.tiebreakSequence.arr.length; index++) {
        tie = s.tiebreakSequence.arr[index];

        if (tie !== 1 && tie !== -1) {
            throw {
                msg : "Invalid number " + tie + " in tiebreak sequence",
                type : "SettingsValidate"
            };
        }
    }

    testInt(s, "minimizationExponent", 1, 5);
    testInt(s, "queueLength", 1, 2);
    testInt(s, "studyLength", 1, 1000000);
    testBoolean("exportExcel");

    for (index = 0; index < s.patients.length; index++) {
        testInt(s.patients[index], "number", 1, 12);

        // This replaces all the patients with a new one so the numbers always
        // match and we don't have to check each property of the patient
        num = s.patients[index].number;
        s.patients[index] = allPatients[num - 1];
    }

    testInt(s, "gatorStreamType", 1, 4);
    testInt(s, "blocksize", 1, 5);

    for (index = 0; index < s.gatorSeq.length; index++) {
        testInt(s.gatorSeq, index, 0, s.numGators - 1);
    }

    return s;
};

$(document).ready(function () {
    var sequenceValid, disableStartButton;

    sequenceValid = {
        gator : true,
        patient : true,
        tie : true
    };

    $("select[name=number]").change(function () {
        $("div#investigators").empty();

        settings.numGators = parseInt($("select[name=number]").val(), 10);

        for (var index = 0; index < settings.numGators; index++) {
            var computerSelect =
                "<select name='computergator" + index + "'>" +
                    "<option selected='selected' >1</option>";
            var computerGroupSelect =
                "<select name='computergroupgator" + index + "'>" +
                    "<option selected='selected' value='treatment'>Treatment</option>" +
                    "<option value='control'>Control</option>" +
                "</select>";
            var playerSelect =
                "<select name='playergator" + index + "'>" +
                    "<option selected='selected' >1</option>";
            var playerGroupSelect =
                "<select name='playergroupgator" + index + "'>" +
                    "<option selected='selected' value='treatment'>Treatment</option>" +
                    "<option value='control'>Control</option>" +
                "</select>";

            for (var c = 2; c < 13; c++) {
                var option = "<option>" + c + "</option>";
                computerSelect += option;
                playerSelect += option;
            }

            computerSelect += "</select>";
            playerSelect += "</select>";

            $("div#investigators").append(
                "<div class='strategy'>" +
                    "<a>Investigator " + (index + 1) + ": </a>" + "<br />" +
                    "<input name='gator" + index + "' type='radio' value='random' checked />Normal" + "<br />" +
                    "<input name='gator" + index + "' type='radio' value='cheat' />Cheat (computer): patient " +
                    computerSelect + " into the " + computerGroupSelect + " group.<br />" +
                    "<input name='gator" + index + "' type='radio' value='player' />Cheat (player): patient " +
                    playerSelect + " into the " + playerGroupSelect + " group." +
                "</div>");
        }
    });

    $("button#start").click(function () {
        var seq, textgator, textpat;

        settings.numGators = parseInt($("select[name=number]").val(), 10);
        settings.queueLength = parseInt($("select[name=minimizationqueuelength]").val(), 10);

        settings.gators = (function () {
            var index, selectedStrategy, numPatient, targetGroup, gators;

            gators = [];

            for (index = 0; index < settings.numGators; index++) {
                selectedStrategy = $("input[name=gator" + index + "]:checked").val();

                if (selectedStrategy === "random") {
                    gators.push(new Investigator(index + 1, random, "random", 1, "treatment"));
                } else if (selectedStrategy === "cheat") {

                    numPatient = parseInt($("select[name=computergator" + index + "]").val(), 10);
                    targetGroup = $("select[name=computergroupgator" + index + "]").val();

                    gators.push(new Investigator(index + 1, (settings.queueLength === 2 ? random : cheat),
                         (settings.queueLength === 2 ? "random" : "cheat"),
                         (settings.queueLength === 2 ? 1 : numPatient),
                         (settings.queueLangth === 2 ? "treatment" : targetGroup)));
                } else if (selectedStrategy === "player") {
                    numPatient = parseInt($("select[name=playergator" + index + "]").val(), 10);
                    targetGroup = $("select[name=playergroupgator" + index + "]").val();

                    gators.push(new Investigator(index + 1, player, "player", numPatient, targetGroup));
                } else {
                    throw Error;
                }
            }

            return gators;
        })();

        settings.allowedLength = parseInt($("select[name=heldpatients]").val(), 10);
        settings.heldTurns = parseInt($("select[name=heldturns]").val(), 10);
        settings.playerView = $("input[name=playerview]:checked").val();
        settings.autoPlay = $("input[name=autoplay]:checked").val() === "true";
        settings.minimizeInvestigator = $("input[name=minimizeinvestigator]").is(":checked");
        settings.minimizeLength = $("input[name=minimizelength]").is(":checked");
        settings.tiebreakInvestigator = $("input[name=investigatortiebreak]").is(":checked");
        settings.minimizationExponent = parseInt($("select[name=minimizationexponent]").val(), 10);
        settings.exportExcel = $("input[name=exportexcel]").is(":checked");

        settings.blocksize = parseInt($("select[name=blocksize]").val(), 10);

        if (settings.autoPlay) {
            $("button#next").text("Start");
        }

        settings.patients = (function () {
            var eliminated, index, randomNum

            patients = [];

            if ($("select[name=seedtype]").val() === "Random") {
                eliminated = 0;

                $("input[name=filterpatients]").not(":checked").each(function () {
                    for (index = 0; index < allPatients.length; index++) {
                        if (parseInt($(this).val(), 10) === allPatients[index].number) {
                            allPatients.splice(index, 1);
                            return;
                        }
                    }
                });

                settings.studyLength = parseInt($("input[name=patientslength]").val(), 10);

                if (!isNaN(settings.studyLength)) {
                    patients = [];
                    for (index = 0; index < settings.studyLength; index++) {
                        randomNum = Math.floor(Math.random() * allPatients.length);
                        patients.push(new Patient(allPatients[randomNum]));
                    }
                } else {
                    $("input[name=patientslength]").val("");
                    console.error("Not a number");
                    return;
                }
            } else {
                if ($("input[name=patientlist]:checked").val() === "standard") {
                    patients = [eleven, two, nine, six, eleven, five, three,
                    eleven, six, four, eleven, eight, eleven, one, twelve, four, eleven];

                    settings.studyLength = 17;
                } else if ($("input[name=patientlist]:checked").val() === "own") {

                    seq = $("input[name=ownsequence]").val();

                    if (validateSequence(seq)) {
                        patients = [];
                        seq = seq.split(",");
                        for (var index = 0; index < seq.length; index++) {
                            seq[index] = parseInt(seq[index], 10) - 1;
                            patients.push(new Patient(allPatients[seq[index]]));
                        }

                        settings.studyLength = seq.length;

                        patients.reverse();
                    } else {
                        return;
                    }
                } else {
                    console.error("Something else selected");
                }
            }

            return patients;
        })();

        if ($("input[name=usetiebreaksequence]").is(":checked")) {
            settings.tiebreakSequence = (function () {
                var arr, str, obj;

                str = $("input[name=tiebreaksequencestr]").val();

                arr = str.split(",").map(function (elem) {
                    return parseInt(elem, 10);
                });

                obj = {
                    arr : arr.reverse(),
                    str : str
                };

                return obj;
            })();
        } else {
            settings.tiebreakSequence = (function (length) {
                var rand, index, arr, str, obj;

                arr = [];
                str = "";

                for (index = 0; index < length; index++) {
                    rand = Math.floor(Math.random() * 2);
                    rand = rand === 0 ? -1 : rand;
                    arr.push(rand);
                }

                str += arr[0];
                for (index = 1; index < length; index++) {
                    str += ", " + arr[index];
                }

                obj = {
                    arr : arr.reverse(),
                    str : str
                };

                return obj;
            })(settings.studyLength);
        }

        $("input#tiebreaksequence").val(settings.tiebreakSequence.str);

        // 1 : order, 2 : predetermined, 3 : random
        switch (settings.gatorStreamType) {
            case 1:
                for (index = 0; index < settings.studyLength; index++) {
                    settings.gatorSeq[index] = index % settings.gators.length;
                }
                break;
            case 2:
                settings.gatorSeq = $("input[name=gatorsequence]").val();
                settings.gatorSeq = settings.gatorSeq.split(",");
                for (index = 0; index < settings.gatorSeq.length; index++) {
                    settings.gatorSeq[index] = parseInt(settings.gatorSeq[index], 10) - 1;
                }
                break;
            case 3:
                settings.gatorSeq = getNBlock(settings.numGators,
                    settings.studyLength, settings.blocksize);
                break;
            case 4:
                settings.gatorSeq = getAlternating(settings.numGators,
                    settings.studyLength);
                break;
            default:
                console.error("Invalid state");
                break;
        }

        $("input#savesequence").show();
        textpat = "";

        for (index = settings.patients.length - 1; index >= 0; index--) {
            textpat = textpat + settings.patients[index].number;
            if (index !== 0) {
                textpat = textpat + ", ";
            }
        }

        settings.patStr = textpat;

        textgator = "";
        for (index = 0; index < settings.gatorSeq.length; index++) {
            textgator = textgator + (settings.gatorSeq[index] + 1);
            if (index !== settings.gatorSeq.length - 1) {
                textgator = textgator + ", ";
            }
        }

        settings.gatorStr = textgator;

        $("input#savesequence").val(textpat);
        $("input#gatorsavesequence").val(textgator);
        $("div#someupdates").hide();

        setup(settings.gators, settings.patients, settings.tiebreakSequence);
    });

    $("select[name=seedtype]").change(function () {
        if ($("select[name=seedtype]").val() === "Random") {
            $("div#randompatients").show();
            $("div#setpatients").hide();

            sequenceValid.patient = true;
            disableStartButton();
        } else {
            $("div#randompatients").hide();
            $("div#setpatients").show();

            sequenceValid.patient = validateSequence($("input[name=ownsequence]").val());
            disableStartButton();
        }
    });

    $("select[name=gatorseedtype]").change(function () {
        var choice;

        choice = $("select[name=gatorseedtype]").val();

        if (choice === "predetermined") {
            sequenceValid.gator = validateGatorSequence($("input[name=gatorsequence]").val());
            disableStartButton();
        } else {
            sequenceValid.gator = true;
            disableStartButton();
        }

        switch (choice) {
            case "order":
                $("#randomgators, #setgators, #alternategators").hide();
                settings.gatorStreamType = 1;
                break;
            case "predetermined":
                $("#randomgators, #alternategators").hide();
                $("#setgators").show();
                settings.gatorStreamType = 2;
                break;
            case "random":
                $("#setgators, #alternategators").hide();
                $("#randomgators").show();
                settings.gatorStreamType = 3;
                break;
            case "alternate":
                $("#setgators, #randomgators").hide();
                $("#alternategators").show();
                settings.gatorStreamType = 4;
                break;
            default:
                console.error("Invalid selection");
                break;
        }
    });
    $("input[name=includeall]").click(function () {
        if ($("input[name=includeall]").is(":checked")) {
            $("input[name=filterpatients]").prop("checked", true);
            $("input[name=includenone]").prop("checked", false);
        }
    });
    $("input[name=includenone]").click(function () {
        if ($("input[name=includenone]").is(":checked")) {
            $("input[name=filterpatients]").prop("checked", false);
            $("input[name=includeall]").prop("checked", false);
        }
    });
    $("input[name=filterpatients]").click(function () {
        var checkedLength = $("input[name=filterpatients]:checked").length;
        if (checkedLength === 0) {
            $("input[name=includenone]").prop("checked", true);
        } else if (checkedLength === 12) {
            $("input[name=includeall]").prop("checked", true);
        } else {
            $("input[name=includeall], input[name=includenone]").prop("checked", false);
        }
    });
    $("input[name=ownsequence]").on("input", function () {
        var seq = $(this).val();
        var selOwn = $("input[name=patientlist]:checked").val() === "own";

        if (!selOwn) {
            $("i#ownseqvalid").hide();
        } else {
            sequenceValid.patient = validateSequence(seq);
            disableStartButton();
        }
    });

    $("input[name=usetiebreaksequence]").click(function () {
        var seq;

        seq = $("input[name=tiebreaksequencestr]").val();

        if ($(this).is(":checked")) {
            $("i#tiebreaksequencevalid").show();
            sequenceValid.tie = validateTieSequence(seq);
        } else {
            $("i#tiebreaksequencevalid").hide();
            sequenceValid.tie = true;
        }

        disableStartButton();
    });

    $("input[name=tiebreaksequencestr]").on("input", function() {
        var seq = $(this).val();

        if (jQuery.trim(seq) !== "") {
            $("input[name=usetiebreaksequence]").prop("checked", true);
        }

        sequenceValid.tie = validateTieSequence(seq);
        disableStartButton();
    });

    $("input[name=gatorsequence]").on("input", function () {
        var seq = $(this).val();

        sequenceValid.gator = validateGatorSequence(seq);
        disableStartButton();
    });

    $("input[name=minimizeinvestigator]").on("click", function () {
        if ($(this).is(":checked")) {
            $("input[name=investigatortiebreak]").attr("disabled", "disabled");
        } else {
            $("input[name=investigatortiebreak]").removeAttr("disabled");
        }
    });

    $("input#import").click(function () {
        var str, gator, index;

        str = $("input#importdata").val();

        try {
            newSettings = validateSettings(str)
        } catch (err) {
            if (err.type === "SettingsValidate") {
                console.error(err.msg);
            } else {
                throw err;
            }
        }

        // Investigator number drop down
        $("select[name=number]").val(newSettings.numGators).trigger("change");

        // Set investigator properties
        for (index = 0; index < newSettings.gators.length; index++) {
            gator = newSettings.gators[index];

            $("input[name=gator" + index + "]").val([gator.strategyName]);

            if (gator.strategyName === "player") {
                $("select[name=playergator" + index + "]").val(gator.selectPatient);
                $("select[name=playergroupgator" + index + "]").val(gator.targetGroup);
            } else if (gator.strategyName === "cheat") {
                $("select[name=computergator" + index + "]").val(gator.selectPatient);
                $("select[name=computergroupgator" + index + "]").val(gator.targetGroup);
            } else {
                // Strategy is random, nothing else to fill out
            }
        }

        // Held patients
        $("select[name=heldpatients]").val(newSettings.allowedLength);

        // Held patient turns
        $("select[name=heldturns]").val(newSettings.heldTurns);

        // Full or last two lines
        $("input[name=playerview]").val([newSettings.playerView]);

        // Take turns without select patient
        $("input[name=autoplay]").val([newSettings.autoPlay]);

        // Minimize Investigator (pretty lame to trigger two clicks to preserve
        // the state)
        $("input[name=minimizeinvestigator]").val([newSettings.minimizeInvestigator])
            .trigger("click").trigger("click");

        // Use group length in minimization
        $("input[name=minimizelength]").val([newSettings.minimizeLength]);

        // Use investigator for tie break
        $("input[name=investigatortiebreak]").val([newSettings.tiebreakInvestigator]);

        // Tiebreak sequence, always set so that the sequence stays the same
        $("input[name=usetiebreaksequence]").val([true]);

        $("input[name=tiebreaksequencestr]").val(newSettings.tiebreakSequence.str)
            .trigger("change");

        $("select[name=minimizationexponent]").val(newSettings.minimizationExponent);
        $("select[name=minimizationqueuelength]").val(newSettings.queueLength);

        // Export to Excel
        $("input[name=exportexcel]").val([newSettings.exportExcel]);

        // Always change to predetermined instead of re-generating the sequence
        $("select[name=seedtype]").val("Predetermined").trigger("change");
        $("input[name=patientlist]").val(["own"]);
        $("input[name=ownsequence]").val(newSettings.patStr).trigger("input");

        // Always change to own sequence instead of re-generating
        $("select[name=gatorseedtype]").val("predetermined").trigger("change");
        $("input[name=gatorsequence]").val(newSettings.gatorStr).trigger("input");
    });

    disableStartButton = function () {
        var s;

        s = sequenceValid;

        if (s.tie && s.gator && s.patient) {
            $("#start").removeAttr("disabled");
        } else {
            $("#start").attr("disabled", "disabled");
        }
    };

    $("button#restart").click(function () {
        window.location.reload();
    });
});