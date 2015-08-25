// Game parameters
var allowedLength = 1;
var heldTurns = 4;
var playerView = "full";
var autoPlay = false;
var minimizeInvestigator = false;
var minimizationExponent = 1;
var queueLength = 1;

// 1 : order, 2 : predetermined, 3 : n-block, 4 : alternate
var gatorStreamType = 1;
var diffTally = [];
var gatorSeq = [];
var study; // This is a global for use at the console

var extraInfoRow = function (count) {
    return "<td>" + count + "</td>";
};

var extraInfoString = function (countArr, gatorNum) {
    var tableString, index;

    tableString = "<tr><td>" + gatorNum + "</td>";

    for (index = 0; index < countArr.length; index++) {
        tableString += extraInfoRow(countArr[index]);
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

    this.getTag = function () {
        var alphabet = "abcdefghijklmnopqrstuvwxyz";
        return alphabet[this.tagdex++ % alphabet.length];
    };

    this.holdPatient = function (heldPatient) {
        if (heldTurns === 0) {
            writeMessage(this.number, heldPatient, "discard");
        } else {
            this.heldPatients.push({
                patient: heldPatient,
                turns: heldTurns
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
    this.patientsElem = table.siblings("table.totaltable").find("td.total.table");
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
        if (minimizeInvestigator) {
            for (var index = 0; index < this.investigators.length; index++) {
                var current = this.investigators[index];
                current.elem.text(current.count);
            }
        }
    };
};
var Trial = function (investigators, doOutput) {

    this.numInvestigators = investigators.length;

    if (minimizeInvestigator) {
        for (var index = 0; index < this.numInvestigators; index++) {
            $("tr.title").append("<td>Investigator " + (index + 1) + "</td>");
            $("tr.table").append("<td class='i" + index + "'></td>");
        }
    }

    this.endGame = doOutput ?
        endGame :
        function (investigators, patients, control, treatment) {
            console.log("Study Ended");
            console.log(control);
            console.log(treatment);
        };

    if (!minimizeInvestigator) {
        $("tr.header td.gator").hide();
    }

    $("tr.header .gator").prop("colspan", this.numInvestigators);
    $("tr.table").children("td").text("0");

    this.control = new Group("Control", $("#control table.maintable"), this.numInvestigators);
    this.treatment = new Group("Treatment", $("#treatment table.maintable"), this.numInvestigators);
    this.queue = [];

    this.noInteraction = (function () {
        var i, gator, noInteraction;

        noInteraction = autoPlay;

        for (i = 0; noInteraction && i < investigators.length; i++) {

            gator = investigators[i];
            noInteraction = gator.strategyName !== "player";
        }

        return noInteraction;
    }).call();

    this.treatmentGroups = [];
    this.controlGroups = [];

    this.getChiSquares = function () {
        var control, treatment, diff, res, i, j, chi_square, avg;

        diff = [];
        chi_square = [];

        res = this.fillStatsTable();
        control = res.control;
        treatment = res.treatment;

        for (i = 0; i < control.length; i++) {
            diff[i] = [];
            chi_square[i] = [];

            for (j = 0; j < control[i].length; j++) {
                diff[i][j] = treatment[i][j] - control[i][j];
                avg = (treatment[i][j] + control[i][j]) / 2;

                chi_square[i][j] = 2 * Math.pow(control[i][j] - avg, 2) / avg;
            }
        }

        return {
            d : diff,
            chi : chi_square
        };
    };

    this.fillStatsTable = function () {
        var c, t, cstr, tstr, index, mapFn;

        c = countStats(this.control.patients, this.numInvestigators);
        t = countStats(this.treatment.patients, this.numInvestigators);

        if (doOutput) {
            cstr = "";
            tstr = "";

            mapFn = function (dex) {
                return function (elem) {
                    return elem[dex];
                };
            };

            for (index = 0; index < this.numInvestigators; index++) {
                cstr += extraInfoString(c.map(mapFn(index)), index + 1);
                tstr += extraInfoString(t.map(mapFn(index)), index + 1);
            }

            $("#controlhead").after(cstr);
            $("#treathead").after(tstr);
            $("#frequencydata").show();
        }

        return {
            control : c,
            treatment : t
        };
    };

    // This function works almost exactly like nextInvestigator only it performs
    // a loop rather than waiting for something to call it again
    this.doStudyNoInteraction = function (isCountMod, allInvestigators,
        allPatients, gatorSeq) {

        var currentInvestigator, i, j;

        for (i = 0; i < allPatients.length; i++) {
            currentInvestigator = isCountMod ?
                allInvestigators[i % allInvestigators.length] :
                allInvestigators[gatorSeq[i]];

            for (j = 0; j < allInvestigators.length; j++) {
                allInvestigators[j].heldCounter();
            }

            if (currentInvestigator !== undefined) {
                currentInvestigator.takeTurn(currentInvestigator.number, this,
                    i + 1, allInvestigators, allPatients);
            } else {
                this.endGame(allInvestigators, allPatients);
            }
        }
    };

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
            var result, tie, groupRes;
            result = minimize(patient, investigator.number, trialClosure.control, trialClosure.treatment);
            if (result.res === "control") {
                trialClosure.control = result.control;

                if (doOutput) {
                    writeMessage(patient.investigator, patient, "add", "control");
                    trialClosure.control.updateTable();
                }

                groupRes = "control";
            } else if (result.res === "treatment") {
                trialClosure.treatment = result.treatment;

                if (doOutput) {
                    writeMessage(patient.investigator, patient, "add", "treatment");
                    trialClosure.treatment.updateTable();
                }

                groupRes = "treatment";
            } else if (result.res === "tie") {
                tie = Math.floor(Math.random() * 2);
                if (tie === 0) {
                    trialClosure.treatment = result.treatment;

                    if (doOutput) {
                        writeMessage(patient.investigator, patient, "add", "tietreatment");
                        trialClosure.treatment.updateTable();
                    }

                    groupRes = "treatment";
                } else {
                    trialClosure.control = result.control;

                    if (doOutput) {
                        writeMessage(patient.investigator, patient, "add", "tiecontrol");
                        trialClosure.control.updateTable();
                    }

                    groupRes = "control";
                }
            } else {

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
        if (this.queue.length === queueLength && queueLength === 2) {
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

            diff1 = groupDiff(c1, this.treatment);
            diff2 = groupDiff(this.control, t2);
            diff3 = groupDiff(c3, t3);
            diff4 = groupDiff(c4, t4);

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
        } else if (this.queue.length === queueLength && queueLength === 1) {
            rawDiff = minimize(patient, investigator.number, this.control, this.treatment).ad;
            diffTally.push(rawDiff);

            pushToGroup(this.queue.pop().pat);
        } else {

        }
    };
};

var groupDiff = function (controlGroup, treatmentGroup) {
    var comparison = {};
    for (var prop in controlGroup.characteristics) {
        comparison[prop] = Math.pow(Math.abs(controlGroup.characteristics[prop].count - treatmentGroup.characteristics[prop].count), minimizationExponent);
    }
    if (minimizeInvestigator) {
        for (var index = 0; index < controlGroup.investigators.length; index++) {
            comparison["i" + index] = Math.pow(Math.abs(controlGroup.investigators[index].count - treatmentGroup.investigators[index].count), minimizationExponent);
        }
    }
    comparison.subjects = Math.pow(Math.abs(controlGroup.patients.length - treatmentGroup.patients.length), minimizationExponent);
    var diff = 0;
    for (prop in comparison) {
        diff += comparison[prop];
    }
    return diff;
};

var minimize = function (patient, investigator, control, treatment) {
    var addDiff;
    var newControlTest = jQuery.extend(true, {}, control);
    var newTreatmentTest = jQuery.extend(true, {}, treatment);

    newControlTest.addPatient(patient, investigator);
    newTreatmentTest.addPatient(patient, investigator);

    var controlDiff = groupDiff(newControlTest, treatment);
    var treatmentDiff = groupDiff(newTreatmentTest, control);

    addDiff = treatmentDiff - controlDiff;
    if (treatmentDiff > controlDiff) {
        return {
            res: "control",
            control: newControlTest,
            treatment: treatment,
            ad: addDiff
        };
    } else if (treatmentDiff < controlDiff) {
        return {
            res: "treatment",
            control: control,
            treatment: newTreatmentTest,
            ad: addDiff
        };
    } else {
        return {
            res: "tie",
            control: newControlTest,
            treatment: newTreatmentTest,
            ad: addDiff
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
        study.endGame(allInvestigators, allPatients);
    } else {
        if (autoPlay) {

            var res = study.addPatient(patient, investigator);
            if (investigator.selectPatient !== undefined && investigator.targetGroup !== undefined && patient.number === investigator.selectPatient) {
                investigator.targetsGiven++;
                patient.tag = investigator.getTag();
            }

            if (!study.noInteraction) {
                nextInvestigator(allInvestigators, allPatients, count, study);
            }
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
        tryHeld();

        if (patient.number === investigator.selectPatient) {
            patient.tag = investigator.getTag();
            investigator.targetsGiven++;
            var result = minimize(patient, gatorNumber, study.control, study.treatment);
            if (result.res === investigator.targetGroup) {
                study.addPatient(patient, investigator);
            } else {
                investigator.holdPatient(patient);
            }
        } else {
            patientRes = study.addPatient(patient, investigator);
            tryHeld();
        }

        if (!study.noInteraction) {
            nextInvestigator(allInvestigators, allPatients, count, study);
        }
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
        study.endGame(allInvestigators, allPatients);
    } else {
        if (autoPlay) {
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

        nextInvestigator(allInvestigators, allPatients, count, study);
    };

    var currentPatientPrediction = function () {
        var result = minimize(patient, gatorNumber, study.control, study.treatment);
        $("a.playergroup").text(result.res);
    };

    var heldTable = function () {
        $("button#playerhold").toggle(investigator.heldPatients.length !== allowedLength && !patientPlaced);
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
        study.endGame(allInvestigators, allPatients);
    } else {
        if (autoPlay && patient.number !== this.selectPatient) {
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
            if (heldTurns === 0) {
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
};

var nextInvestigator = function (allInvestigators, allPatients, count, study) {
    var currentInvestigator;

    if (gatorStreamType === 1) {
        currentInvestigator = allInvestigators[count % allInvestigators.length];
    } else {
        currentInvestigator = allInvestigators[gatorSeq[count]];
    }

    for (var index = 0; index < allInvestigators.length; index++) {
        allInvestigators[index].heldCounter();
    }

    count++;

    if (currentInvestigator !== undefined) {
        currentInvestigator.takeTurn(currentInvestigator.number, study, count,
            allInvestigators, allPatients);
    } else {
        study.endGame(allInvestigators, allPatients);
    }
};

var endGame = function (allInvestigators, allPatients) {
    for (var index = 0; index < allInvestigators.length; index++) {
        var investigator = allInvestigators[index];
        if (investigator.strategyName === "cheat" || investigator.strategyName === "random") {
            writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore, given: investigator.targetsGiven }, "score");
        } else if (investigator.strategyName === "player") {
            writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore, given: investigator.targetsGiven }, "score", "player");
        }
    }

    study.fillStatsTable();
};
var writeMessage = function (gatorNum, patient, action, result) {
    var message, meanRes;
    if (gatorNum === 0) {
        if (action === "end") {
            message = "<a>" + result + "</a><br />";
        } else if (action === "diff") {
            meanRes = mean(diffTally);
            message = "<a>Mean difference between the groups was " + meanRes.mean.toString().substr(0, 5) +
                            ", median difference between the groups was " + median(diffTally) + "</a><br />" +
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
    if (playerView === "full") {
        $("div#messages div").prepend(message);
    } else if (playerView === "partial") {
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
    var re = /^(\s)*(([1-9]|1[0-2]),(\s)*)*([1-9]|1[0-2])(\s)*$/;
    var pass = re.test(sequence);
    $("i#ownseqvalid").show();
    if (pass) {
        $("i#ownseqvalid").attr("class", "fa fa-check");
        $("button#start").removeAttr("disabled");
    } else {
        $("i#ownseqvalid").attr("class", "fa fa-exclamation");
        $("button#start").attr("disabled", "disabled");
    }
    return pass;
};
var validateGatorSequence = function (sequence) {
    var re;
    re = /^((\s)*[1-9],(\s)*)*([1-9])(\s)*$/;
    return re.test(sequence);
};

var repeatStudy = function (parameters, investigators) {
    var study = new Trial(investigators, false);
    var count = 0;

    nextInvestigator(investigators, undefined /* patients */, count, study);
};

var setup = function (allInvestigators, studyPatients, gatorSeq) {
    study = new Trial(allInvestigators, true);
    var count = 0;

    $("div#studysetup").hide();
    $("div#study").show();
    $("div#patient").show();
    $("div#cards").show();
    $("div#playerturn").hide();
    $("button#next").show();
    $("button#next").on("click", function () {
        $("button#next").off("click");

        if (study.noInteraction) {
            study.doStudyNoInteraction(gatorStreamType === 1, allInvestigators,
                studyPatients, gatorSeq);
        } else {
            nextInvestigator(allInvestigators, studyPatients, count, study,
                gatorSeq);
        }
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

var getAlternating = function (types, length, dir) {
    var blocks, finalArr, forwardArr, backwardArr, blockArr, i, j;

    blocks = Math.ceil( length / (types * 2) );
    finalArr = [];
    forwardArr = [];
    backwardArr = [];

    for (j = types - 1; j >= 0; j--) {
        forwardArr.push(j);
        backwardArr.push(j);
    }

    if (dir === "ascending") {
        blockArr = forwardArr.reverse().concat(backwardArr);
    } else {
        blockArr = backwardArr.concat(forwardArr.reverse());
    }

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

$(document).ready(function () {

    $("select[name=number]").change(function () {
        $("div#investigators").empty();

        var numGators = parseInt($("select[name=number]").val(), 10);

        for (var index = 0; index < numGators; index++) {
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
        var gators, numGators, seq, blocksize, textgator;
        gators = [];
        numGators = parseInt($("select[name=number]").val(), 10);

        queueLength = parseInt($("select[name=minimizationqueuelength]").val(), 10);

        for (var index = 0; index < numGators; index++) {
            var selectedStrategy = $("input[name=gator" + index + "]:checked").val();

            if (selectedStrategy === "random") {
                gators.push(new Investigator(index + 1, random, "random", 1, "treatment"));
            } else if (selectedStrategy === "cheat") {

                var numPatient = parseInt($("select[name=computergator" + index + "]").val(), 10);
                var targetGroup = $("select[name=computergroupgator" + index + "]").val();

                gators.push(new Investigator(index + 1, (queueLength === 2 ? random : cheat),
                     (queueLength === 2 ? "random" : "cheat"), numPatient, targetGroup));
            } else if (selectedStrategy === "player") {
                numPatient = parseInt($("select[name=playergator" + index + "]").val(), 10);
                targetGroup = $("select[name=playergroupgator" + index + "]").val();

                gators.push(new Investigator(index + 1, player, "player", numPatient, targetGroup));
            } else {
                throw Error;
            }
        }

        allowedLength = parseInt($("select[name=heldpatients]").val(), 10);
        heldTurns = parseInt($("select[name=heldturns]").val(), 10);
        playerView = $("input[name=playerview]:checked").val();
        autoPlay = $("input[name=autoplay]:checked").val() === "true";
        minimizeInvestigator = $("input[name=minimizeinvestigator]").is(":checked");
        minimizationExponent = parseInt($("select[name=minimizationexponent]").val(), 10);

        blocksize = parseInt($("select[name=blocksize]").val(), 10);

        if (autoPlay) {
            $("button#next").text("Start");
        }
        var patients;
        if ($("select[name=seedtype]").val() === "Random") {
            var eliminated = 0;

            $("input[name=filterpatients]").not(":checked").each(function () {
                for (var index = 0; index < allPatients.length; index++) {
                    if (parseInt($(this).val(), 10) === allPatients[index].number) {
                        allPatients.splice(index, 1);
                        return;
                    }
                }
            });

            var studyLength = parseInt($("input[name=patientslength]").val(), 10);

            if (!isNaN(studyLength)) {
                patients = [];
                for (var index = 0; index < studyLength; index++) {
                    var randomNum = Math.floor(Math.random() * allPatients.length);
                    patients.push(new Patient(allPatients[randomNum]));
                }
            } else {
                $("input[name=patientslength]").val("");
                console.error("Not a number");
                return;
            }
        } else {
            if ($("input[name=patientlist]:checked").val() === "standard") {
                patients = [eleven, two, nine, six, eleven, five, three, eleven, six, four, eleven, eight, eleven, one, twelve, four, eleven];
            } else if ($("input[name=patientlist]:checked").val() === "own") {
                seq = $("input[name=ownsequence]").val();
                if (validateSequence(seq)) {
                    patients = [];
                    seq = seq.split(",");
                    for (var index = 0; index < seq.length; index++) {
                        seq[index] = parseInt(seq[index], 10) - 1;
                        patients.push(new Patient(allPatients[seq[index]]));
                    }
                    patients.reverse();
                } else {
                    return;
                }
            } else {
                console.error("Something else selected");
            }
        }
        // 1 : order, 2 : predetermined, 3 : random, 4 : alternating
        switch (gatorStreamType) {
            case 1:
                break;
            case 2:
                gatorSeq = $("input[name=gatorsequence]").val();
                gatorSeq = gatorSeq.split(",");
                for (index = 0; index < gatorSeq.length; index++) {
                    gatorSeq[index] = parseInt(gatorSeq[index], 10) - 1;
                }
                break;
            case 3:
                gatorSeq = getNBlock(numGators, studyLength, blocksize);
                break;
            case 4:
                gatorSeq = getAlternating(numGators, studyLength);
                break;
            default:
                console.error("Invalid state");
                break;
        }
        $("input#savesequence").show();

        var textpat = "";
        for (var index = patients.length - 1; index >= 0; index--) {
            textpat = textpat + patients[index].number;
            if (index !== 0) {
                textpat = textpat + ", ";
            }
        }

        textgator = "";

        for (index = 0; index < gatorSeq.length; index++) {
            textgator = textgator + (gatorSeq[index] + 1);
            if (index !== gatorSeq.length - 1) {
                textgator = textgator + ", ";
            }
        }
        $("input#savesequence").val(textpat);
        $("input#gatorsavesequence").val(textgator);
        $("div#someupdates").hide();

        setup(gators, patients, gatorSeq);
    });

    $("select[name=seedtype]").change(function () {
        if ($("select[name=seedtype]").val() === "Random") {
            $("div#randompatients").show();
            $("div#setpatients").hide();
        } else {
            $("div#randompatients").hide();
            $("div#setpatients").show();
        }
    });
    $("select[name=gatorseedtype]").change(function () {
        var choice;
        choice = $("select[name=gatorseedtype]").val();
        switch (choice) {
            case "order":
                $("#randomgators, #setgators, #alternategators").hide();
                gatorStreamType = 1;
                break;
            case "predetermined":
                $("#randomgators, #alternategators").hide();
                $("#setgators").show();
                gatorStreamType = 2;
                break;
            case "random":
                $("#setgators, #alternategators").hide();
                $("#randomgators").show();
                gatorStreamType = 3;
                break;
            case "alternate":
                $("#setgators, #randomgators").hide();
                $("#alternategators").show();
                gatorStreamType = 4;
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
            validateSequence(seq);
        }
    });
    $("input[name=gatorsequence]").on("input", function () {
        var seq = $(this).val();
        if (validateGatorSequence(seq)) {
            $("#start").removeAttr("disabled");
            $("i#gatorsequencevalid").removeClass("fa-exclamation").addClass("fa-check");
        } else {
            $("#start").attr("disabled", "disabled");
            $("i#gatorsequencevalid").removeClass("fa-check").addClass("fa-exclamation");
        }
    });
    $("button#restart").click(function () {
        window.location.reload();
    });
});