#include "PluginProcessor.h"

namespace
{
    bool readBoolVar(const juce::var& value)
    {
        if (value.isBool()) return static_cast<bool>(value);
        if (value.isInt() || value.isDouble()) return static_cast<int>(value) > 0;
        return value.toString().trim().equalsIgnoreCase("true") || value.toString().trim() == "1";
    }

    float readFloatVar(const juce::var& value)
    {
        if (value.isDouble()) return static_cast<float>(static_cast<double>(value));
        if (value.isInt()) return static_cast<float>(static_cast<int>(value));
        return value.toString().getFloatValue();
    }
}

void MiniLAB3StepSequencerAudioProcessor::updateUiMetadataFromVar(const juce::var& stateVar)
{
    juce::var parsedVar = stateVar;
    if (parsedVar.isString()) parsedVar = juce::JSON::parse(parsedVar.toString());
    if (parsedVar.isVoid() || !parsedVar.isObject()) return;

    auto* object = parsedVar.getDynamicObject();
    if (object == nullptr) return;

    if (object->hasProperty("themeIdx")) themeIndex.store(static_cast<int>(object->getProperty("themeIdx")), std::memory_order_release);
    if (object->hasProperty("footerTab")) {
        juce::String ft = object->getProperty("footerTab").toString();
        int ftIdx = 0;
        if (ft == "Gate") ftIdx = 1; else if (ft == "Probability") ftIdx = 2; else if (ft == "Shift") ftIdx = 3; else if (ft == "Swing") ftIdx = 4;
        footerTabIndex.store(ftIdx, std::memory_order_release);
    }

    if (object->hasProperty("activeIdx")) activePatternIndex.store(juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, static_cast<int>(object->getProperty("activeIdx"))), std::memory_order_release);
    if (object->hasProperty("activePatternIndex")) activePatternIndex.store(juce::jlimit(0, MiniLAB3Seq::kNumPatterns - 1, static_cast<int>(object->getProperty("activePatternIndex"))), std::memory_order_release);

    if (object->hasProperty("selectedTrack")) currentInstrument.store(juce::jlimit(0, MiniLAB3Seq::kNumTracks - 1, static_cast<int>(object->getProperty("selectedTrack"))), std::memory_order_release);
    if (object->hasProperty("currentPage")) currentPage.store(juce::jlimit(0, MiniLAB3Seq::kNumPages - 1, static_cast<int>(object->getProperty("currentPage"))), std::memory_order_release);
    if (object->hasProperty("activeSection")) activeSection.store(juce::jlimit(-1, MiniLAB3Seq::kNumPages - 1, static_cast<int>(object->getProperty("activeSection"))), std::memory_order_release);
    if (object->hasProperty("uiScale")) uiScale.store(static_cast<float>(static_cast<double>(object->getProperty("uiScale"))), std::memory_order_release);
}

void MiniLAB3StepSequencerAudioProcessor::setStepDataFromVar(const juce::var& stateVar)
{
    juce::var parsedVar = stateVar;
    if (parsedVar.isString()) parsedVar = juce::JSON::parse(parsedVar.toString());
    if (parsedVar.isVoid() || !parsedVar.isObject()) return;

    auto* object = parsedVar.getDynamicObject();
    if (object == nullptr) return;

    updateUiMetadataFromVar(stateVar);

    auto parsePattern = [&](juce::DynamicObject* dataObj, PatternSnapshot& patternWrite, int pIdx)
        {
            if (!dataObj) return;

            const juce::StringArray matrixKeys{ "activeSteps", "velocities", "gates", "probabilities", "repeats", "shifts", "swings" };
            for (const auto& key : matrixKeys)
            {
                if (!dataObj->hasProperty(key)) continue;
                if (auto* tracks = dataObj->getProperty(key).getArray())
                {
                    for (int track = 0; track < juce::jmin(MiniLAB3Seq::kNumTracks, tracks->size()); ++track)
                    {
                        if (auto* steps = tracks->getReference(track).getArray())
                        {
                            for (int step = 0; step < juce::jmin(MiniLAB3Seq::kNumSteps, steps->size()); ++step)
                            {
                                if (key == "activeSteps") patternWrite[track][step].isActive = readBoolVar(steps->getReference(step));
                                else
                                {
                                    const float value = readFloatVar(steps->getReference(step));
                                    if (key == "velocities") patternWrite[track][step].velocity = value / 100.0f;
                                    else if (key == "gates") patternWrite[track][step].gate = value / 100.0f;
                                    else if (key == "probabilities") patternWrite[track][step].probability = value / 100.0f;
                                    else if (key == "repeats") patternWrite[track][step].repeats = static_cast<int>(value);
                                    else if (key == "shifts") patternWrite[track][step].shift = value / 100.0f;
                                    else if (key == "swings") patternWrite[track][step].swing = value / 100.0f;
                                }
                            }
                        }
                    }
                }
            }

            if (pIdx == activePatternIndex.load(std::memory_order_acquire))
            {
                if (dataObj->hasProperty("midiKeys")) {
                    if (auto* notes = dataObj->getProperty("midiKeys").getArray()) {
                        for (int t = 0; t < juce::jmin(MiniLAB3Seq::kNumTracks, notes->size()); ++t) {
                            const int midiNote = MiniLAB3Seq::parseMidiNoteName(notes->getReference(t).toString());
                            setParameterFromPlainValue("note_" + juce::String(t + 1), static_cast<float>(midiNote));
                        }
                    }
                }
                if (dataObj->hasProperty("trackStates")) {
                    if (auto* states = dataObj->getProperty("trackStates").getArray()) {
                        for (int t = 0; t < juce::jmin(MiniLAB3Seq::kNumTracks, states->size()); ++t) {
                            if (auto* trackState = states->getReference(t).getDynamicObject()) {
                                setParameterFromPlainValue("mute_" + juce::String(t + 1), readBoolVar(trackState->getProperty("mute")) ? 1.0f : 0.0f);
                                setParameterFromPlainValue("solo_" + juce::String(t + 1), readBoolVar(trackState->getProperty("solo")) ? 1.0f : 0.0f);

                                if (trackState->hasProperty("scale")) trackScales[t].store(static_cast<int>(trackState->getProperty("scale")), std::memory_order_release);
                                if (trackState->hasProperty("sequence")) setTrackSequenceNative(t, trackState->getProperty("sequence").toString(), false);

                                if (trackState->hasProperty("length")) {
                                    trackLengths[pIdx][t].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, static_cast<int>(trackState->getProperty("length"))), std::memory_order_release);
                                }

                                if (trackState->hasProperty("timeDivision")) {
                                    trackTimeDivisions[pIdx][t].store(juce::jlimit(0, 4, static_cast<int>(trackState->getProperty("timeDivision"))), std::memory_order_release);
                                }
                            }
                        }
                    }
                }
            }
        };

    if (object->hasProperty("patterns"))
    {
        modifySequencerState([&](MatrixSnapshot& writeMatrix)
            {
                if (auto* pArray = object->getProperty("patterns").getArray())
                {
                    for (int i = 0; i < juce::jmin(MiniLAB3Seq::kNumPatterns, pArray->size()); ++i)
                    {
                        if (auto* pObj = pArray->getReference(i).getDynamicObject())
                            parsePattern(pObj->getProperty("data").getDynamicObject(), writeMatrix[i], i);
                    }
                }
            });
    }
    else
    {
        const int pIdx = activePatternIndex.load(std::memory_order_acquire);
        auto* patternObject = object->hasProperty("patternData") ? object->getProperty("patternData").getDynamicObject() : object;
        modifyPatternState(pIdx, [&](PatternSnapshot& patternWrite) { parsePattern(patternObject, patternWrite, pIdx); });
    }

    requestLedRefresh();
    markUiStateDirty();
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildPatternDataVar(int patternIndex) const
{
    juce::DynamicObject::Ptr data = new juce::DynamicObject();
    juce::Array<juce::var> activeSteps, velocities, probabilities, gates, shifts, swings, repeats, midiKeys, trackStates;
    PatternSnapshot readPattern{};
    copyActivePattern(patternIndex, readPattern);

    for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
    {
        juce::Array<juce::var> activeRow, velocityRow, probabilityRow, gateRow, shiftRow, swingRow, repeatRow;
        for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step)
        {
            const auto& stepData = readPattern[track][step];
            activeRow.add(stepData.isActive);
            velocityRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(stepData.velocity * 100.0f))));
            probabilityRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(stepData.probability * 100.0f))));
            gateRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(stepData.gate * 100.0f))));
            shiftRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(stepData.shift * 100.0f))));
            swingRow.add(juce::jlimit(0, 100, static_cast<int>(std::round(stepData.swing * 100.0f))));
            repeatRow.add(stepData.repeats);
        }

        activeSteps.add(activeRow); velocities.add(velocityRow); probabilities.add(probabilityRow);
        gates.add(gateRow); shifts.add(shiftRow); swings.add(swingRow); repeats.add(repeatRow);

        midiKeys.add(MiniLAB3Seq::midiNoteToName(static_cast<int>(std::round(noteParams[track]->load()))));
        juce::DynamicObject::Ptr state = new juce::DynamicObject();
        state->setProperty("mute", muteParams[track]->load() > 0.5f);
        state->setProperty("solo", soloParams[track]->load() > 0.5f);
        state->setProperty("midiChannel", trackMidiChannels[track].load(std::memory_order_acquire));

        state->setProperty("scale", trackScales[track].load(std::memory_order_acquire));
        juce::String seqStr;
        for (int i = 0; i < trackSequenceLengths[track].load(std::memory_order_acquire); ++i)
            seqStr += juce::String(trackPitchSequences[track][i].load(std::memory_order_acquire)) + " ";
        state->setProperty("sequence", seqStr.trim());

        state->setProperty("length", trackLengths[patternIndex][track].load(std::memory_order_acquire));
        state->setProperty("timeDivision", trackTimeDivisions[patternIndex][track].load(std::memory_order_acquire));

        trackStates.add(juce::var(state.get()));
    }

    data->setProperty("activeSteps", activeSteps); data->setProperty("velocities", velocities);
    data->setProperty("probabilities", probabilities); data->setProperty("gates", gates);
    data->setProperty("shifts", shifts); data->setProperty("swings", swings);
    data->setProperty("repeats", repeats); data->setProperty("midiKeys", midiKeys);
    data->setProperty("trackStates", trackStates);

    return juce::var(data.get());
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildCurrentPatternStateVar() const
{
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    const int pIdx = activePatternIndex.load(std::memory_order_acquire);

    root->setProperty("patternData", buildPatternDataVar(pIdx));
    root->setProperty("currentInstrument", currentInstrument.load(std::memory_order_acquire));
    root->setProperty("selectedTrack", currentInstrument.load(std::memory_order_acquire));
    root->setProperty("currentPage", currentPage.load(std::memory_order_acquire));
    root->setProperty("activeSection", activeSection.load(std::memory_order_acquire));
    root->setProperty("activePatternIndex", pIdx);
    root->setProperty("activeIdx", pIdx);
    return juce::var(root.get());
}

juce::var MiniLAB3StepSequencerAudioProcessor::buildFullUiStateVarForEditor() const
{
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    juce::Array<juce::var> patterns;

    for (int i = 0; i < MiniLAB3Seq::kNumPatterns; ++i) {
        juce::DynamicObject::Ptr patternObj = new juce::DynamicObject();
        patternObj->setProperty("id", patternUUIDs[i]);
        patternObj->setProperty("name", "Pattern " + juce::String(MiniLAB3Seq::kPatternLabels[i]));
        patternObj->setProperty("data", buildPatternDataVar(i));
        patterns.add(juce::var(patternObj.get()));
    }

    root->setProperty("patterns", patterns);
    root->setProperty("activeIdx", activePatternIndex.load(std::memory_order_acquire));
    root->setProperty("selectedTrack", currentInstrument.load(std::memory_order_acquire));
    root->setProperty("currentPage", currentPage.load(std::memory_order_acquire));
    root->setProperty("activeSection", activeSection.load(std::memory_order_acquire));
    root->setProperty("themeIdx", themeIndex.load(std::memory_order_acquire));
    root->setProperty("uiScale", uiScale.load(std::memory_order_acquire));

    int ft = footerTabIndex.load(std::memory_order_acquire);
    juce::String ftStr = (ft == 1) ? "Gate" : (ft == 2) ? "Probability" : (ft == 3) ? "Shift" : (ft == 4) ? "Swing" : "Velocity";
    root->setProperty("footerTab", ftStr);

    return juce::var(root.get());
}

void MiniLAB3StepSequencerAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    std::unique_ptr<juce::XmlElement> xml(state.createXml());

    xml->setAttribute("version", 1);

    auto* patternsXml = xml->createNewChildElement("Patterns");
    MatrixSnapshot matrix{};
    buildActiveMatrixSnapshot(matrix);

    for (int p = 0; p < MiniLAB3Seq::kNumPatterns; ++p)
    {
        auto* patternXml = patternsXml->createNewChildElement("Pattern");
        patternXml->setAttribute("index", p);

        for (int track = 0; track < MiniLAB3Seq::kNumTracks; ++track)
        {
            auto* trackElement = patternXml->createNewChildElement("Track");
            trackElement->setAttribute("name", instrumentNames[track]);
            trackElement->setAttribute("length", trackLengths[p][track].load(std::memory_order_acquire));
            trackElement->setAttribute("timeDivision", trackTimeDivisions[p][track].load(std::memory_order_acquire));
            trackElement->setAttribute("midiChannel", trackMidiChannels[track].load(std::memory_order_acquire));
            trackElement->setAttribute("scale", trackScales[track].load(std::memory_order_acquire));

            juce::String seqStr;
            for (int i = 0; i < trackSequenceLengths[track].load(std::memory_order_acquire); ++i)
                seqStr += juce::String(trackPitchSequences[track][i].load(std::memory_order_acquire)) + " ";
            trackElement->setAttribute("sequence", seqStr.trim());

            juce::String steps, velocities, gates, probabilities, repeats, shifts, swings;
            for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step)
            {
                const auto& sd = matrix[p][track][step];
                steps += sd.isActive ? "1" : "0";
                velocities += juce::String(sd.velocity) + ",";
                gates += juce::String(sd.gate) + ",";
                probabilities += juce::String(sd.probability) + ",";
                repeats += juce::String(sd.repeats) + ",";
                shifts += juce::String(sd.shift) + ",";
                swings += juce::String(sd.swing) + ",";
            }
            trackElement->setAttribute("steps", steps); trackElement->setAttribute("velocities", velocities);
            trackElement->setAttribute("gates", gates); trackElement->setAttribute("probabilities", probabilities);
            trackElement->setAttribute("repeats", repeats); trackElement->setAttribute("shifts", shifts);
            trackElement->setAttribute("swings", swings);
        }
    }

    auto* uiXml = xml->createNewChildElement("UIState");
    uiXml->setAttribute("activePatternIndex", activePatternIndex.load(std::memory_order_acquire));
    uiXml->setAttribute("currentInstrument", currentInstrument.load(std::memory_order_acquire));
    uiXml->setAttribute("currentPage", currentPage.load(std::memory_order_acquire));
    uiXml->setAttribute("activeSection", activeSection.load(std::memory_order_acquire));
    uiXml->setAttribute("themeIdx", themeIndex.load(std::memory_order_acquire));
    uiXml->setAttribute("footerTab", footerTabIndex.load(std::memory_order_acquire));
    uiXml->setAttribute("uiScale", static_cast<double>(uiScale.load(std::memory_order_acquire)));

    copyXmlToBinary(*xml, destData);
}

void MiniLAB3StepSequencerAudioProcessor::setStateInformation(const void* data, int size)
{
    initialising.store(true, std::memory_order_release);
    std::unique_ptr<juce::XmlElement> xmlState(getXmlFromBinary(data, size));
    if (xmlState == nullptr) {
        initialising.store(false, std::memory_order_release);
        return;
    }

    int stateVersion = xmlState->getIntAttribute("version", 0);

    if (stateVersion == 0)
    {
        if (auto* oldMatrix = xmlState->getChildByName("Matrix")) {
            auto* patternsXml = xmlState->createNewChildElement("Patterns");
            auto* pattern0 = patternsXml->createNewChildElement("Pattern");
            pattern0->setAttribute("index", 0);

            while (auto* track = oldMatrix->getChildByName("Track")) {
                oldMatrix->removeChildElement(track, false);
                pattern0->addChildElement(track);
            }
            xmlState->removeChildElement(oldMatrix, true);
        }
        stateVersion = 1;
        xmlState->setAttribute("version", 1);
    }

    if (xmlState->hasTagName(apvts.state.getType())) {
        auto apvtsXml = std::make_unique<juce::XmlElement>(*xmlState);
        for (auto* child = apvtsXml->getFirstChildElement(); child != nullptr;) {
            auto* next = child->getNextElement();
            if (child->hasTagName("Patterns") || child->hasTagName("ReactUIState") || child->hasTagName("UIState"))
                apvtsXml->removeChildElement(child, true);
            child = next;
        }
        auto restoredTree = juce::ValueTree::fromXml(*apvtsXml);
        if (restoredTree.isValid()) apvts.replaceState(restoredTree);
    }

    modifySequencerState([&](MatrixSnapshot& writeMatrix)
        {
            auto parseTrackXml = [&](juce::XmlElement* trackElement, int pIdx, int track) {
                instrumentNames[track] = trackElement->getStringAttribute("name", instrumentNames[track]);
                trackMidiChannels[track].store(trackElement->getIntAttribute("midiChannel", 1), std::memory_order_release);

                if (trackElement->hasAttribute("scale"))
                    trackScales[track].store(trackElement->getIntAttribute("scale", 0), std::memory_order_release);
                if (trackElement->hasAttribute("sequence"))
                    setTrackSequenceNative(track, trackElement->getStringAttribute("sequence"), false);

                const int savedLength = trackElement->getIntAttribute("length", 0);
                if (savedLength > 0)
                    trackLengths[pIdx][track].store(juce::jlimit(1, MiniLAB3Seq::kNumSteps, savedLength), std::memory_order_release);

                if (trackElement->hasAttribute("timeDivision"))
                    trackTimeDivisions[pIdx][track].store(juce::jlimit(0, 4, trackElement->getIntAttribute("timeDivision", 3)), std::memory_order_release);

                const auto steps = trackElement->getStringAttribute("steps");
                juce::StringArray vels, gates, probs, reps, shifts, swings;
                vels.addTokens(trackElement->getStringAttribute("velocities"), ",", "");
                gates.addTokens(trackElement->getStringAttribute("gates"), ",", "");
                probs.addTokens(trackElement->getStringAttribute("probabilities"), ",", "");
                reps.addTokens(trackElement->getStringAttribute("repeats"), ",", "");
                shifts.addTokens(trackElement->getStringAttribute("shifts"), ",", "");
                swings.addTokens(trackElement->getStringAttribute("swings"), ",", "");

                for (int step = 0; step < MiniLAB3Seq::kNumSteps; ++step) {
                    auto& stepData = writeMatrix[pIdx][track][step];
                    stepData.isActive = (step < steps.length() && steps[step] == '1');
                    if (step < vels.size()) stepData.velocity = vels[step].getFloatValue();
                    if (step < gates.size()) stepData.gate = gates[step].getFloatValue();
                    if (step < probs.size()) stepData.probability = probs[step].getFloatValue();
                    if (step < reps.size()) stepData.repeats = reps[step].getIntValue();
                    if (step < shifts.size()) stepData.shift = shifts[step].getFloatValue();
                    if (step < swings.size()) stepData.swing = swings[step].getFloatValue();
                }
                };

            if (auto* patternsXml = xmlState->getChildByName("Patterns")) {
                for (auto* patternXml : patternsXml->getChildIterator()) {
                    int pIdx = patternXml->getIntAttribute("index", 0);
                    if (pIdx < 0 || pIdx >= MiniLAB3Seq::kNumPatterns) continue;
                    int track = 0;
                    for (auto* trackElement : patternXml->getChildIterator()) {
                        if (!trackElement->hasTagName("Track") || track >= MiniLAB3Seq::kNumTracks) continue;
                        parseTrackXml(trackElement, pIdx, track);
                        ++track;
                    }
                }
            }
        });

    if (auto* uiXml = xmlState->getChildByName("UIState")) {
        activePatternIndex.store(uiXml->getIntAttribute("activePatternIndex", 0), std::memory_order_release);
        currentInstrument.store(uiXml->getIntAttribute("currentInstrument", 0), std::memory_order_release);
        currentPage.store(uiXml->getIntAttribute("currentPage", 0), std::memory_order_release);
        activeSection.store(uiXml->getIntAttribute("activeSection", -1), std::memory_order_release);
        themeIndex.store(uiXml->getIntAttribute("themeIdx", 0), std::memory_order_release);
        footerTabIndex.store(uiXml->getIntAttribute("footerTab", 0), std::memory_order_release);
        uiScale.store(static_cast<float>(uiXml->getDoubleAttribute("uiScale", 1.0)), std::memory_order_release);
    }
    else {
        activePatternIndex.store(xmlState->getIntAttribute("activePatternIndex", 0), std::memory_order_release);
        activeSection.store(xmlState->getIntAttribute("activeSection", -1), std::memory_order_release);
    }

    requestLedRefresh();
    markUiStateDirty();
    initialising.store(false, std::memory_order_release);
}