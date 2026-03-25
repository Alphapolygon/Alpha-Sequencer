#include "PluginProcessor.h"

namespace {
    bool readBoolVar(const juce::var& value) {
        if (value.isBool()) return static_cast<bool>(value);
        if (value.isInt() || value.isDouble()) return static_cast<int>(value) > 0;
        return value.toString().trim().equalsIgnoreCase("true") || value.toString().trim() == "1";
    }
    float readFloatVar(const juce::var& value) {
        if (value.isDouble()) return static_cast<float>(static_cast<double>(value));
        if (value.isInt()) return static_cast<float>(static_cast<int>(value));
        return value.toString().getFloatValue();
    }
}

void MiniLAB3StepSequencerAudioProcessor::updateUiMetadataFromVar(const juce::var& stateVar) {
    juce::var parsedVar = stateVar; if (parsedVar.isString()) parsedVar = juce::JSON::parse(parsedVar.toString());
    if (parsedVar.isVoid() || !parsedVar.isObject()) return;
    auto* object = parsedVar.getDynamicObject(); if (object == nullptr) return;

    if (object->hasProperty("themeIdx")) themeIndex.store(static_cast<int>(object->getProperty("themeIdx")));
    if (object->hasProperty("visibleTracks")) visibleTracks.store(juce::jlimit(1, 16, static_cast<int>(object->getProperty("visibleTracks"))));
    if (object->hasProperty("footerTab")) {
        juce::String ft = object->getProperty("footerTab").toString(); int ftIdx = 0;
        if (ft == "Gate") ftIdx = 1; else if (ft == "Probability") ftIdx = 2; else if (ft == "Shift") ftIdx = 3; else if (ft == "Swing") ftIdx = 4; else if (ft == "Pitch") ftIdx = 5;
        footerTabIndex.store(ftIdx);
    }
    if (object->hasProperty("activeIdx")) activePatternIndex.store(juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, static_cast<int>(object->getProperty("activeIdx"))));
    if (object->hasProperty("selectedTrack")) currentInstrument.store(juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, static_cast<int>(object->getProperty("selectedTrack"))));
    if (object->hasProperty("currentPage")) currentPage.store(juce::jlimit(0, MiniLAB3Seq::kNumPages - 1, static_cast<int>(object->getProperty("currentPage"))));
    if (object->hasProperty("activeSection")) activeSection.store(juce::jlimit(-1, MiniLAB3Seq::kNumPages - 1, static_cast<int>(object->getProperty("activeSection"))));
    if (object->hasProperty("uiScale")) uiScale.store(static_cast<float>(static_cast<double>(object->getProperty("uiScale"))));
}

void MiniLAB3StepSequencerAudioProcessor::setStepDataFromVar(const juce::var& stateVar) {
    juce::var parsedVar = stateVar; if (parsedVar.isString()) parsedVar = juce::JSON::parse(parsedVar.toString());
    if (parsedVar.isVoid() || !parsedVar.isObject()) return;
    auto* object = parsedVar.getDynamicObject(); if (object == nullptr) return;

    updateUiMetadataFromVar(stateVar);

    auto parsePattern = [&](juce::DynamicObject* dataObj, PatternSnapshot& patternWrite, int pIdx) {
        if (!dataObj) return;
        const juce::StringArray matrixKeys{ "activeSteps", "velocities", "gates", "probabilities", "repeats", "shifts", "swings", "pitches" };
        for (const auto& key : matrixKeys) {
            if (!dataObj->hasProperty(key)) continue;
            if (auto* tracks = dataObj->getProperty(key).getArray()) {
                for (int track = 0; track < juce::jmin(MiniLAB3Seq::kNumTracks, tracks->size()); ++track) {
                    if (auto* steps = tracks->getReference(track).getArray()) {
                        for (int step = 0; step < juce::jmin(MiniLAB3Seq::kNumSteps, steps->size()); ++step) {
                            if (key == "activeSteps") patternWrite[track][step].isActive = readBoolVar(steps->getReference(step));
                            else {
                                const float value = readFloatVar(steps->getReference(step));
                                if (key == "velocities") patternWrite[track][step].velocity = value / 100.0f;
                                else if (key == "gates") patternWrite[track][step].gate = value / 100.0f;
                                else if (key == "probabilities") patternWrite[track][step].probability = value / 100.0f;
                                else if (key == "repeats") patternWrite[track][step].repeats = static_cast<int>(value);
                                else if (key == "shifts") patternWrite[track][step].shift = value / 100.0f;
                                else if (key == "swings") patternWrite[track][step].swing = value / 100.0f;
                                else if (key == "pitches") patternWrite[track][step].pitch = static_cast<int>(value);
                            }
                        }
                    }
                }
            }
        }

        if (dataObj->hasProperty("randomAmounts")) {
            if (auto* ra = dataObj->getProperty("randomAmounts").getArray()) {
                for (int t = 0; t < juce::jmin(MiniLAB3Seq::kNumTracks, ra->size()); ++t) {
                    if (auto* params = ra->getReference(t).getArray()) {
                        for (int i = 0; i < juce::jmin(6, params->size()); ++i) trackRandomAmounts[pIdx][t][i].store(readFloatVar(params->getReference(i)));
                    }
                }
            }
        }

        if (pIdx == activePatternIndex.load()) {
            if (dataObj->hasProperty("midiKeys")) {
                if (auto* notes = dataObj->getProperty("midiKeys").getArray()) {
                    for (int t = 0; t < juce::jmin(MiniLAB3Seq::kNumTracks, notes->size()); ++t) {
                        setParameterFromPlainValue("note_" + juce::String(t + 1), static_cast<float>(MiniLAB3Seq::parseMidiNoteName(notes->getReference(t).toString())));
                    }
                }
            }
            if (dataObj->hasProperty("trackStates")) {
                if (auto* states = dataObj->getProperty("trackStates").getArray()) {
                    for (int t = 0; t < juce::jmin(MiniLAB3Seq::kNumTracks, states->size()); ++t) {
                        if (auto* trackState = states->getReference(t).getDynamicObject()) {
                            setParameterFromPlainValue("mute_" + juce::String(t + 1), readBoolVar(trackState->getProperty("mute")) ? 1.0f : 0.0f);
                            setParameterFromPlainValue("solo_" + juce::String(t + 1), readBoolVar(trackState->getProperty("solo")) ? 1.0f : 0.0f);
                            if (trackState->hasProperty("scale")) trackScales[t].store(static_cast<int>(trackState->getProperty("scale")));
                            if (trackState->hasProperty("length")) trackLengths[pIdx][t].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, static_cast<int>(trackState->getProperty("length"))));
                            if (trackState->hasProperty("timeDivision")) trackTimeDivisions[pIdx][t].store(juce::jlimit(0, 4, static_cast<int>(trackState->getProperty("timeDivision"))));
                        }
                    }
                }
            }
        }
        };

    if (object->hasProperty("patterns")) {
        modifySequencerState([&](MatrixSnapshot& writeMatrix) {
            if (auto* pArray = object->getProperty("patterns").getArray()) {
                for (int i = 0; i < juce::jmin(MiniLAB3Seq::kNumPatterns, pArray->size()); ++i) {
                    if (auto* pObj = pArray->getReference(i).getDynamicObject()) parsePattern(pObj->getProperty("data").getDynamicObject(), writeMatrix[i], i);
                }
            }
            });
    }
    else {
        const int pIdx = activePatternIndex.load();
        auto* patternObject = object->hasProperty("patternData") ? object->getProperty("patternData").getDynamicObject() : object;
        modifyPatternState(pIdx, [&](PatternSnapshot& patternWrite) { parsePattern(patternObject, patternWrite, pIdx); });
    }

    requestLedRefresh(); markUiStateDirty();
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildPatternDataVar(int patternIndex) const {
    juce::DynamicObject::Ptr data = new juce::DynamicObject();
    juce::Array<juce::var> activeSteps, velocities, probabilities, gates, shifts, swings, repeats, pitches, midiKeys, trackStates, randomAmounts;
    PatternSnapshot readPattern{}; copyActivePattern(patternIndex, readPattern);

    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track) {
        juce::Array<juce::var> aRow, vRow, pRow, gRow, shRow, swRow, rRow, piRow, randArr;
        for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step) {
            const auto& sd = readPattern[track][step];
            aRow.add(sd.isActive); vRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(sd.velocity * 100.0f))));
            pRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(sd.probability * 100.0f))));
            gRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(sd.gate * 100.0f))));
            shRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(sd.shift * 100.0f))));
            swRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(sd.swing * 100.0f))));
            rRow.add(sd.repeats); piRow.add(sd.pitch);
        }
        for (int i = 0; i < 6; i++) randArr.add(trackRandomAmounts[patternIndex][track][i].load());

        activeSteps.add(aRow); velocities.add(vRow); probabilities.add(pRow); gates.add(gRow);
        shifts.add(shRow); swings.add(swRow); repeats.add(rRow); pitches.add(piRow); randomAmounts.add(randArr);

        midiKeys.add(MiniLAB3Seq::midiNoteToName(static_cast<int>(std::round(noteParams[track]->load()))));
        juce::DynamicObject::Ptr state = new juce::DynamicObject();
        state->setProperty("mute", muteParams[track]->load() > 0.5f); state->setProperty("solo", soloParams[track]->load() > 0.5f);
        state->setProperty("midiChannel", trackMidiChannels[track].load()); state->setProperty("scale", trackScales[track].load());
        state->setProperty("length", trackLengths[patternIndex][track].load()); state->setProperty("timeDivision", trackTimeDivisions[patternIndex][track].load());
        trackStates.add(juce::var(state.get()));
    }

    data->setProperty("activeSteps", activeSteps); data->setProperty("velocities", velocities);
    data->setProperty("probabilities", probabilities); data->setProperty("gates", gates);
    data->setProperty("shifts", shifts); data->setProperty("swings", swings);
    data->setProperty("repeats", repeats); data->setProperty("pitches", pitches);
    data->setProperty("midiKeys", midiKeys); data->setProperty("trackStates", trackStates);
    data->setProperty("randomAmounts", randomAmounts);
    return juce::var(data.get());
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildCurrentPatternStateVar() const {
    juce::DynamicObject::Ptr root = new juce::DynamicObject(); const int pIdx = activePatternIndex.load();
    root->setProperty("patternData", buildPatternDataVar(pIdx));
    root->setProperty("currentInstrument", currentInstrument.load()); root->setProperty("selectedTrack", currentInstrument.load());
    root->setProperty("currentPage", currentPage.load()); root->setProperty("activeSection", activeSection.load());
    root->setProperty("activePatternIndex", pIdx); root->setProperty("activeIdx", pIdx);
    return juce::var(root.get());
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildFullUiStateVarForEditor() const {
    juce::DynamicObject::Ptr root = new juce::DynamicObject(); juce::Array<juce::var> patterns;
    for (int i = 0; i < MiniLAB3Seq::kNumPatterns; ++i) {
        juce::DynamicObject::Ptr pObj = new juce::DynamicObject(); pObj->setProperty("id", patternUUIDs[i]);
        pObj->setProperty("name", "Pattern " + juce::String(MiniLAB3Seq::kPatternLabels[i])); pObj->setProperty("data", buildPatternDataVar(i));
        patterns.add(juce::var(pObj.get()));
    }
    root->setProperty("patterns", patterns); root->setProperty("activeIdx", activePatternIndex.load());
    root->setProperty("selectedTrack", currentInstrument.load()); root->setProperty("currentPage", currentPage.load());
    root->setProperty("activeSection", activeSection.load()); root->setProperty("themeIdx", themeIndex.load());
    root->setProperty("uiScale", uiScale.load()); root->setProperty("visibleTracks", visibleTracks.load());
    int ft = footerTabIndex.load(); root->setProperty("footerTab", (ft == 1) ? "Gate" : (ft == 2) ? "Probability" : (ft == 3) ? "Shift" : (ft == 4) ? "Swing" : (ft == 5) ? "Pitch" : "Velocity");
    return juce::var(root.get());
}

void MiniLAB3StepSequencerAudioProcessor::getStateInformation(juce::MemoryBlock& destData) {
    auto state = apvts.copyState(); std::unique_ptr<juce::XmlElement> xml(state.createXml()); xml->setAttribute("version", 2);
    auto* patternsXml = xml->createNewChildElement("Patterns"); MatrixSnapshot matrix{}; buildActiveMatrixSnapshot(matrix);
    for (int p = 0; p < MiniLAB3Seq::kNumPatterns; ++p) {
        auto* patternXml = patternsXml->createNewChildElement("Pattern"); patternXml->setAttribute("index", p);
        for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track) {
            auto* trackElement = patternXml->createNewChildElement("Track");
            trackElement->setAttribute("length", trackLengths[p][track].load()); trackElement->setAttribute("timeDivision", trackTimeDivisions[p][track].load());
            trackElement->setAttribute("midiChannel", trackMidiChannels[track].load()); trackElement->setAttribute("scale", trackScales[track].load());

            juce::String steps, velocities, gates, probabilities, repeats, shifts, swings, pitches, randoms;
            for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step) {
                const auto& sd = matrix[p][track][step];
                steps += sd.isActive ? "1" : "0"; velocities += juce::String(sd.velocity) + ","; gates += juce::String(sd.gate) + ",";
                probabilities += juce::String(sd.probability) + ","; repeats += juce::String(sd.repeats) + ",";
                shifts += juce::String(sd.shift) + ","; swings += juce::String(sd.swing) + ","; pitches += juce::String(sd.pitch) + ",";
            }
            for (int i = 0; i < 6; i++) randoms += juce::String(trackRandomAmounts[p][track][i].load()) + ",";

            trackElement->setAttribute("steps", steps); trackElement->setAttribute("velocities", velocities); trackElement->setAttribute("gates", gates);
            trackElement->setAttribute("probabilities", probabilities); trackElement->setAttribute("repeats", repeats); trackElement->setAttribute("shifts", shifts);
            trackElement->setAttribute("swings", swings); trackElement->setAttribute("pitches", pitches); trackElement->setAttribute("randomAmounts", randoms);
        }
    }
    auto* uiXml = xml->createNewChildElement("UIState");
    uiXml->setAttribute("activePatternIndex", activePatternIndex.load()); uiXml->setAttribute("currentInstrument", currentInstrument.load());
    uiXml->setAttribute("currentPage", currentPage.load()); uiXml->setAttribute("activeSection", activeSection.load());
    uiXml->setAttribute("themeIdx", themeIndex.load()); uiXml->setAttribute("footerTab", footerTabIndex.load());
    uiXml->setAttribute("uiScale", static_cast<double>(uiScale.load())); uiXml->setAttribute("visibleTracks", visibleTracks.load());
    copyXmlToBinary(*xml, destData);
}

void MiniLAB3StepSequencerAudioProcessor::setStateInformation(const void* data, int size) {
    initialising.store(true); std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, size));
    if (xmlState == nullptr) { initialising.store(false); return; }

    if (xmlState->hasTagName(apvts.state.getType())) {
        auto apvtsXml = std::make_unique<juce::XmlElement>(*xmlState);
        for (auto* child = apvtsXml->getFirstChildElement(); child != nullptr;) {
            auto* next = child->getNextElement();
            if (child->hasTagName("Patterns") || child->hasTagName("UIState")) apvtsXml->removeChildElement(child, true);
            child = next;
        }
        auto restoredTree = juce::ValueTree::fromXml(*apvtsXml); if (restoredTree.isValid()) apvts.replaceState(restoredTree);
    }

    modifySequencerState([&](MatrixSnapshot& writeMatrix) {
        if (auto* patternsXml = xmlState->getChildByName("Patterns")) {
            for (auto* patternXml : patternsXml->getChildIterator()) {
                int pIdx = patternXml->getIntAttribute("index", 0); if (pIdx < 0 || pIdx >= MiniLAB3Seq::kNumPatterns) continue;
                int track = 0;
                for (auto* trackElement : patternXml->getChildIterator()) {
                    if (!trackElement->hasTagName("Track") || track >= MiniLAB3Seq::kNumTracks) continue;
                    trackMidiChannels[track].store(trackElement->getIntAttribute("midiChannel", 1));
                    if (trackElement->hasAttribute("scale")) trackScales[track].store(trackElement->getIntAttribute("scale", 0));
                    trackLengths[pIdx][track].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, trackElement->getIntAttribute("length", 16)));
                    trackTimeDivisions[pIdx][track].store(juce::jlimit(0, 4, trackElement->getIntAttribute("timeDivision", 3)));

                    const auto steps = trackElement->getStringAttribute("steps");
                    juce::StringArray vels, gates, probs, reps, shifts, swings, pitches, randoms;
                    vels.addTokens(trackElement->getStringAttribute("velocities"), ",", ""); gates.addTokens(trackElement->getStringAttribute("gates"), ",", "");
                    probs.addTokens(trackElement->getStringAttribute("probabilities"), ",", ""); reps.addTokens(trackElement->getStringAttribute("repeats"), ",", "");
                    shifts.addTokens(trackElement->getStringAttribute("shifts"), ",", ""); swings.addTokens(trackElement->getStringAttribute("swings"), ",", "");
                    pitches.addTokens(trackElement->getStringAttribute("pitches"), ",", ""); randoms.addTokens(trackElement->getStringAttribute("randomAmounts"), ",", "");

                    for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step) {
                        auto& sd = writeMatrix[pIdx][track][step];
                        sd.isActive = (step < steps.length() && steps[step] == '1');
                        if (step < vels.size()) sd.velocity = vels[step].getFloatValue(); if (step < gates.size()) sd.gate = gates[step].getFloatValue();
                        if (step < probs.size()) sd.probability = probs[step].getFloatValue(); if (step < reps.size()) sd.repeats = reps[step].getIntValue();
                        if (step < shifts.size()) sd.shift = shifts[step].getFloatValue(); if (step < swings.size()) sd.swing = swings[step].getFloatValue();
                        if (step < pitches.size()) sd.pitch = pitches[step].getIntValue();
                    }
                    for (int i = 0; i < juce::jmin(6, randoms.size()); ++i) trackRandomAmounts[pIdx][track][i].store(randoms[i].getFloatValue());
                    ++track;
                }
            }
        }
        });

    if (auto* uiXml = xmlState->getChildByName("UIState")) {
        activePatternIndex.store(uiXml->getIntAttribute("activePatternIndex", 0)); currentInstrument.store(uiXml->getIntAttribute("currentInstrument", 0));
        currentPage.store(uiXml->getIntAttribute("currentPage", 0)); activeSection.store(uiXml->getIntAttribute("activeSection", -1));
        themeIndex.store(uiXml->getIntAttribute("themeIdx", 0)); footerTabIndex.store(uiXml->getIntAttribute("footerTab", 0));
        uiScale.store(static_cast<float>(uiXml->getDoubleAttribute("uiScale", 1.0))); visibleTracks.store(uiXml->getIntAttribute("visibleTracks", 16));
    }
    requestLedRefresh(); markUiStateDirty(); initialising.store(false);
}