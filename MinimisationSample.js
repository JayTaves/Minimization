$(document).ready(function () {
    //Game parameters
    var allowedLength = 1;
    var heldTurns = 4;
    var playerView = "full";
    var autoPlay = false;
    var minimizeInvestigator = false;

    var Patient = function (number, gender, age, risk) {
        this.number = number;
        this.gender = gender;
        this.age = age;
        this.risk = risk;
        this.investigator = undefined;
    };
    var Investigator = function (number, strategy, strategyName, patient, group) {
        this.number = number;
        this.takeTurn = strategy;
        this.strategyName = strategyName;
        this.heldPatients = [];
        this.targetScore = 0;
        this.nonTargetScore = 0;
        this.selectPatient = patient;
        this.targetGroup = group;
        this.heldCounter = function () {
            for (var index = 0; index < this.heldPatients.length; index++) {
                var heldPatient = this.heldPatients[index];
                if (heldPatient.turns === 0) {
                    writeMessage(this.number, heldPatient.patient.number, "timeout");
                    this.heldPatients.splice(index, 1);
                    index--;
                }
                heldPatient.turns--;
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
        this.title = table.find("tr.title");
        this.table = table.find("tr.table");
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
        this.addPatient = function (patient, investigator) {
            this.patients.push(patient);
            this.characteristics[patient.gender.text].count += 1;
            this.characteristics[patient.age.text].count += 1;
            this.characteristics[patient.risk.text].count += 1;
            this.investigators[investigator - 1].count += 1;
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
    var Trial = function (investigators) {
        this.numInvestigators = investigators.length;
        if (minimizeInvestigator) {
            for (var index = 0; index < this.numInvestigators; index++) {
                $("tr.title").append("<td>Investigator " + (index + 1) + "</td>");
                $("tr.table").append("<td class='i" + index + "'></td>");
            }
        }
        if (!minimizeInvestigator) {
            $("tr.header td.gator").hide();
        }
        $("tr.header .gator").prop("colspan", this.numInvestigators);
        $("tr.table").children("td").text("0");

        this.control = new Group("Control", $("#control table.maintable"), this.numInvestigators);
        this.treatment = new Group("Treatment", $("#treatment table.maintable"), this.numInvestigators);
        
        this.addPatient = function (patient, investigator) {
            patient.investigator = investigator;
            var result = minimize(patient, investigator, this.control, this.treatment);
            if (result.res === "control") {
                this.control = result.control;
                writeMessage(patient.investigator, patient.number, "add", "control");
                this.control.updateTable();
                return "control";
            } else if (result.res === "treatment") {
                this.treatment = result.treatment;
                writeMessage(patient.investigator, patient.number, "add", "treatment");
                this.treatment.updateTable();
                return "treatment";
            } else if (result.res === "tie") {
                //var tie = this.tiebreak.pop();
                var tie = Math.floor(Math.random() * 2);
                if (tie === 0) {
                    this.treatment = result.treatment;
                    //writeMessage("<a>Investigator " + patient.investigator + " added patient " + patient.number + ". After a tie break it was added to the treatment group.</a><br />");
                    writeMessage(patient.investigator, patient.number, "add", "tietreatment");
                    this.treatment.updateTable();
                    return "treatment";
                } else {
                    this.control = result.control;
                    //writeMessage("<a>Investigator " + patient.investigator + " added patient " + patient.number + ". After a tie break it was added to the control group.</a><br />");
                    writeMessage(patient.investigator, patient.number, "add", "tiecontrol");
                    this.control.updateTable();
                    return "control";
                } 
            }
        };
    }
    var groupDiff = function (controlGroup, treatmentGroup) {
        var comparison = {};
        for (var prop in controlGroup.characteristics) {
            comparison[prop] = Math.abs(controlGroup.characteristics[prop].count - treatmentGroup.characteristics[prop].count);
        }
        if (minimizeInvestigator) {
            for (var index = 0; index < controlGroup.investigators.length; index++) {
                comparison["i" + index] = Math.abs(controlGroup.investigators[index].count - treatmentGroup.investigators[index].count);
            }
        }
        comparison["subjects"] = Math.abs(controlGroup.patients.length - treatmentGroup.patients.length);
        var diff = 0;
        for (var prop in comparison) {
            diff += comparison[prop];
        }
        return diff;
    };
    var minimize = function (patient, investigator, control, treatment) {
        var newControlTest = jQuery.extend(true, {}, control);
        var newTreatmentTest = jQuery.extend(true, {}, treatment);

        newControlTest.addPatient(patient, investigator);
        newTreatmentTest.addPatient(patient, investigator);

        var controlDiff = groupDiff(newControlTest, treatment);
        var treatmentDiff = groupDiff(newTreatmentTest, control);

        if (treatmentDiff > controlDiff) {
            return {
                res: "control",
                control: newControlTest,
                treatment: treatment
            };
        } else if (treatmentDiff < controlDiff) {
            return {
                res: "treatment",
                control: control,
                treatment: newTreatmentTest
            };
        } else {
            return {
                res: "tie",
                control: newControlTest,
                treatment: newTreatmentTest
            }
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
        var patient = displayPatient(allInvestigators, allPatients, count, gatorNumber);
        var investigator = this;
        if (patient === undefined) {
            endGame(allInvestigators, allPatients);
        } else {
            if (autoPlay) {
                var res = study.addPatient(patient, gatorNumber);
                if (investigator.selectPatient !== undefined && investigator.targetGroup !== undefined && patient.number === investigator.selectPatient) {
                    if (res === investigator.targetGroup) {
                        investigator.targetScore++;
                    } else {
                        investigator.nonTargetScore++;
                    }
                }
                nextInvestigator(allInvestigators, allPatients, count, study);
            } else {
                $("button#next").click(function () {
                    $("button#next").off("click");
                    res = study.addPatient(patient, gatorNumber);
                    if (investigator.selectPatient !== undefined && investigator.targetGroup !== undefined && patient.number === investigator.selectPatient) {
                        if (res === investigator.targetGroup) {
                            investigator.targetScore++;
                        } else {
                            investigator.nonTargetScore++;
                        }
                    }
                    nextInvestigator(allInvestigators, allPatients, count, study);
                });
            }
        }
    }
    var cheat = function (gatorNumber, study, count, allInvestigators, allPatients) {
        var patient = displayPatient(allInvestigators, allPatients, count, gatorNumber);
        var turn = function () {
            if (patient.number === investigator.selectPatient) {
                var tryPat = function () {
                    var result = minimize(patient, gatorNumber, study.control, study.treatment);
                    if (result.res === investigator.targetGroup) {
                        var patientRes = study.addPatient(patient, gatorNumber);
                        investigator.targetScore++;
                    } else {
                        if (investigator.heldPatients.length !== 0) {
                            var heldres = minimize(investigator.heldPatients[0].patient, gatorNumber, study.control, study.treatment);
                            if (heldres.res !== investigator.targetGroup) {
                                var sacrificepat = investigator.heldPatients.pop().patient;
                                study.addPatient(sacrificepat, gatorNumber);
                                tryPat();    
                            }
                        } else {
                            if (investigator.heldPatients.length === allowedLength) {
                                //Swap to gain more turns on held patient
                                var discardPatient = investigator.heldPatients.pop().patient;
                                writeMessage(gatorNumber, discardPatient.number, "discard");
                            } else {
                                investigator.heldPatients.push({ patient: patient, turns: heldTurns });
                                writeMessage(gatorNumber, patient.number, "hold");
                            }
                        }
                    }
                }
                tryPat();
            } else {
                var turnOver = false;
                for (var index = 0; !turnOver && index < investigator.heldPatients.length; index++) {
                    var result = minimize(investigator.heldPatients[index].patient, gatorNumber, study.control, study.treatment);
                    if (result.res === investigator.targetGroup && patient.number === investigator.selectPatient) {
                        writeMessage(gatorNumber, patient.number, "discard");
                        patientRes = study.addPatient(investigator.heldPatients.splice(index, 1)[0].patient, gatorNumber);
                        investigator.targetScore++;
                        turnOver = true;
                    }
                } 
                if (!turnOver) {
                    patientRes = study.addPatient(patient, gatorNumber);
                }
            }
            //investigator.heldCounter();
            nextInvestigator(allInvestigators, allPatients, count, study);
        };
        if (patient === undefined) {
            endGame(allInvestigators, allPatients);
        } else {
            var investigator = this;
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
            var patientRes = study.addPatient(patient, gatorNumber);
            if (patient.number === investigator.selectPatient) {
                if (patientRes === investigator.targetGroup) {
                    investigator.targetScore++;
                } else {
                    investigator.nonTargetScore++;
                }
            }
            patientPlaced = true;
            heldTable();
            $("button.actions").hide();
            $("span#allottedpatient").hide();
            $("button#playerendturn").show();
        };
        var hold = function () {
            investigator.heldPatients.push({ 
                patient: patient, 
                turns: heldTurns 
            });
            writeMessage(gatorNumber, patient.number, "hold");
            patientPlaced = true;
            heldTable();
            $("button.actions").hide();
            $("span#allottedpatient").hide();
            $("button#playerendturn").show();
        };
        var discard = function () {
            writeMessage(investigator.number, patient.number, "discard");
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
                        writeMessage(gatorNumber, patient.number, "discard");
                        currentPatientPrediction();
                        heldTable();
                    };
                };
                var addHeld = function (number) {
                    return function () {
                        $("button.discardheld, button.addheld").off("click");
                        var patient = investigator.heldPatients.splice(number, 1)[0].patient;
                        var patientRes = study.addPatient(patient, gatorNumber);
                        if (patient.number === investigator.selectPatient) {
                            if (patientRes === investigator.targetGroup) {
                                investigator.targetScore++;
                            } else {
                                investigator.nonTargetScore++;
                            }
                        }
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
            if (autoPlay && patient.number !== this.selectPatient) {
                add();
                endTurn();
            } else {
                $("div#playerturn").show();
                $("button#next").hide();
                $("a.playergator").text(gatorNumber);
                $("a.playerpatient").text(patient.number);
                $("span#allottedpatient").show();
                $("button.player").show();
                $("button#playerendturn").hide();
                currentPatientPrediction();
                heldTable();
                $("button#playeradd").on("click", function () {
                    $("button.actions").off("click");
                    add();
                });
                $("button#playerhold").on("click", function () {
                    $("button.actions").off("click");
                    hold();
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
    }

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
        var currentInvestigator = allInvestigators[count % allInvestigators.length];
        for (var index = 0; index < allInvestigators.length; index++) {
            allInvestigators[index].heldCounter();
        }
        count++;
        currentInvestigator.takeTurn(currentInvestigator.number, study, count, allInvestigators, allPatients);
    }
    var endGame = function (allInvestigators, allPatients) {
        for (var index = 0; index < allInvestigators.length; index++) {
            var investigator = allInvestigators[index];
            if (investigator.strategyName === "cheat" || investigator.strategyName === "random") {
                writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore }, "score");
            } else if (investigator.strategyName === "player") {
                writeMessage(investigator.number, { target: investigator.targetScore, nonTarget: investigator.nonTargetScore }, "score", "player");
            }
        }
    }
    var writeMessage = function (gatorNum, patientNum, action, result) {
        var message;
        if (gatorNum === 0) {
            if (action === "end") {
                message = "<a>" + result + "</a><br />";
            } 
        } else {
            if (action === "add") {
                message = "<a>Investigator " + gatorNum + " added patient " + patientNum + ".";
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
                message = "<a>Investigator " + gatorNum + " held patient " + patientNum + ".</a><br />";
            } else if (action === "discard") {
                message = "<a>Investigator " + gatorNum + " discarded patient " + patientNum + " from the study.</a><br />";
            } else if (action === "timeout") {
                message = "<a>Investigator " + gatorNum + " discarded patient " + patientNum + " because it was held for too long.</a><br />";
            } else if (action === "score") {
                var points = patientNum.target;
                var nonPoints = patientNum.nonTarget;
                message = "<a>Investigator " + gatorNum;
                if (result === "player") {
                    message += " (you)";
                }
                message += " got " + points + " into their target group and " + nonPoints + " into the other group.</a><br />";
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
    }
    var setup = function (allInvestigators, allPatients) {
        var study = new Trial(allInvestigators);
        var count = 0;
        var next;
        
        var nextIteration = function () {
            $("button#next").show();
            if (next !== undefined) {
                var currentPatient = next.patient;
                var currentInvestigator = allInvestigators[count % allInvestigators.length];
                currentInvestigator.takeTurn(currentPatient, currentInvestigator.number, study, nextIteration, count);
                count++;
            }
            var nextInvestigator = allInvestigators[(count) % allInvestigators.length];
            var patientTemp = allPatients.pop();
            if (allPatients.length === 0) {
                $("button#next").hide();
                $("div#messages div").prepend("<a>No more patients to sort. Study ended.</a><br />");
            }
            patientTemp.investigator = nextInvestigator.number;
            next = new nextPatient(patientTemp, $("tr.patient.table"));
            next.updateTable();
        };
        $("div#studysetup").hide();
        $("div#study").show();
        $("div#patient").show();
        $("div#cards").show();
        $("div#playerturn").hide();
        $("button#next").show();
        $("button#next").on("click", function () {
            $("button#next").off("click");
            nextInvestigator(allInvestigators, allPatients, count, study);
        });
    };
    
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
        var gators = [];
        var numGators = parseInt($("select[name=number]").val(), 10);

        for (var index = 0; index < numGators; index++) {
            var selectedStrategy = $("input[name=gator" + index + "]:checked").val();
            if (selectedStrategy === "random") {
                gators.push(new Investigator(index + 1, random, "random", 1, "treatment"));
            } else if (selectedStrategy === "cheat") {
                var numPatient = parseInt($("select[name=computergator" + index + "]").val(), 10);
                var targetGroup = $("select[name=computergroupgator" + index + "]").val();
                gators.push(new Investigator(index + 1, cheat, "cheat", numPatient, targetGroup));
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
                    patients.push(allPatients[randomNum]);
                }
            } else {
                $("input[name=patientslength]").val("");
                console.error("Not a number");
                return;
            }
        } else {
            if ($("input[name=patientlist]:checked").val() === "standard") {
                patients = [eleven, two, nine, six, eleven, five, three, eleven, six, four, eleven, eight, eleven, one, twelve, four, eleven];
            } else if ($("input[name=patientlist]:checked").val() === "other1") {
                patients = [allPatients[12], allPatients[3], allPatients[10], allPatients[7], allPatients[12], allPatients[6], allPatients[4], allPatients[12], allPatients[7], allPatients[10], allPatients[0], allPatients[11], allPatients[3], allPatients[10]];
            } else {
                console.error("Something else selected");
            }
        }
        setup(gators, patients);
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
    $("button#restart").click(function () {
        window.location.reload();
    });
});