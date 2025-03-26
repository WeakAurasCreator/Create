const progressbarTemplate = {
    "d": {
      "actions": {
        "finish": [],
        "init": [],
        "start": []
      },
      "alpha": 1,
      "anchorFrameType": "SCREEN",
      "anchorPoint": "CENTER",
      "animation": {
        "finish": {
          "duration_type": "seconds",
          "easeStrength": 3,
          "easeType": "none",
          "type": "none"
        },
        "main": {
          "duration_type": "seconds",
          "easeStrength": 3,
          "easeType": "none",
          "type": "none"
        },
        "start": {
          "duration_type": "seconds",
          "easeStrength": 3,
          "easeType": "none",
          "type": "none"
        }
      },
      "authorOptions": [],
      "backgroundColor": [
        0,
        0,
        0,
        0.5
      ],
      "barColor": [
        1,
        0,
        0,
        1
      ],
      "barColor2": [
        1,
        1,
        0,
        1
      ],
      "conditions": [],
      "config": [],
      "desaturate": false,
      "enableGradient": false,
      "frameStrata": 1,
      "gradientOrientation": "HORIZONTAL",
      "height": 40,
      "icon": false,
      "iconSource": -1,
      "icon_color": [
        1,
        1,
        1,
        1
      ],
      "icon_side": "RIGHT",
      "id": "New 3",
      "information": [],
      "internalVersion": 66,
      "inverse": false,
      "load": {
        "class": {
          "multi": []
        },
        "size": {
          "multi": []
        },
        "spec": {
          "multi": []
        },
        "talent": {
          "multi": []
        }
      },
      "orientation": "HORIZONTAL",
      "regionType": "aurabar",
      "selfPoint": "CENTER",
      "semver": "1.0.3",
      "spark": false,
      "sparkBlendMode": "ADD",
      "sparkColor": [
        1,
        1,
        1,
        1
      ],
      "sparkHeight": 30,
      "sparkHidden": "NEVER",
      "sparkOffsetX": 0,
      "sparkOffsetY": 0,
      "sparkRotation": 0,
      "sparkRotationMode": "AUTO",
      "sparkTexture": "Interface\\CastingBar\\UI-CastingBar-Spark",
      "sparkWidth": 10,
      "subRegions": [
        {
          "type": "subbackground"
        },
        {
          "type": "subforeground"
        },
        {
          "anchorXOffset": 0,
          "anchorYOffset": 0,
          "rotateText": "NONE",
          "text_anchorPoint": "INNER_LEFT",
          "text_automaticWidth": "Auto",
          "text_color": [
            1,
            1,
            1,
            1
          ],
          "text_fixedWidth": 64,
          "text_font": "Friz Quadrata TT",
          "text_fontSize": 20,
          "text_fontType": "None",
          "text_justify": "CENTER",
          "text_selfPoint": "AUTO",
          "text_shadowColor": [
            0,
            0,
            0,
            1
          ],
          "text_shadowXOffset": 1,
          "text_shadowYOffset": -1,
          "text_text": "%p",
          "text_text_format_p_format": "timed",
          "text_text_format_p_time_dynamic_threshold": 60,
          "text_text_format_p_time_format": 0,
          "text_text_format_p_time_legacy_floor": false,
          "text_text_format_p_time_mod_rate": true,
          "text_text_format_p_time_precision": 1,
          "text_visible": true,
          "text_wordWrap": "WordWrap",
          "type": "subtext"
        },
        {
          "anchorXOffset": 0,
          "anchorYOffset": 0,
          "rotateText": "NONE",
          "text_anchorPoint": "INNER_RIGHT",
          "text_automaticWidth": "Auto",
          "text_color": [
            1,
            1,
            1,
            1
          ],
          "text_fixedWidth": 64,
          "text_font": "Friz Quadrata TT",
          "text_fontSize": 20,
          "text_fontType": "None",
          "text_justify": "CENTER",
          "text_selfPoint": "AUTO",
          "text_shadowColor": [
            0,
            0,
            0,
            1
          ],
          "text_shadowXOffset": 1,
          "text_shadowYOffset": -1,
          "text_text": "%n",
          "text_text_format_n_format": "none",
          "text_visible": true,
          "text_wordWrap": "WordWrap",
          "type": "subtext"
        },
        {
          "border_anchor": "bar",
          "border_color": [
            0,
            0,
            0,
            1
          ],
          "border_edge": "Square Full White",
          "border_offset": 0,
          "border_size": 2,
          "border_visible": true,
          "type": "subborder"
        }
      ],
      "texture": "Clean",
      "tocversion": 110100,
      "triggers": {
        "1": {
          "trigger": {
            "debuffType": "HELPFUL",
            "delay": 5,
            "duration": "5",
            "event": "Encounter Events",
            "eventtype": "ENCOUNTER_START",
            "names": [],
            "spellIds": [],
            "subeventPrefix": "SPELL",
            "subeventSuffix": "_CAST_START",
            "type": "event",
            "unit": "player",
            "use_delay": true,
            "use_eventtype": true
          },
          "untrigger": []
        },
        "activeTriggerMode": -10
      },
      "uid": "PqgCxVzDhgh",
      "url": "https://wago.io/CCI8wma95/4",
      "useAdjustededMax": false,
      "useAdjustededMin": false,
      "version": 4,
      "wagoID": "CCI8wma95",
      "width": 200,
      "xOffset": 0,
      "yOffset": 0,
      "zoom": 0
    },
    "m": "d",
    "s": "5.7.0",
    "v": 1421,
    "wagoID": "CCI8wma95"
  }