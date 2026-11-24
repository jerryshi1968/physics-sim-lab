import type { EquipmentInstance } from '../core/equipment/schema.ts';
import type { Connection } from '../core/connections/schema.ts';

export const seriesReferenceEquipment: EquipmentInstance[] = [
  {
    "id": "E",
    "type": "electrical.power-supply",
    "definitionVersion": 1,
    "pose": {
      "xM": -0.32,
      "yM": 0.12,
      "rotationRad": 0,
      "flippedX": true
    },
    "parameters": {
      "voltageV": 9
    }
  },
  {
    "id": "S",
    "type": "electrical.switch",
    "definitionVersion": 1,
    "pose": {
      "xM": 0,
      "yM": 0.12,
      "rotationRad": 0,
      "flippedX": false
    },
    "parameters": {
      "closed": true
    }
  },
  {
    "id": "A",
    "type": "electrical.ammeter",
    "definitionVersion": 1,
    "pose": {
      "xM": -0.17280616101651425,
      "yM": -0.2985061552017168,
      "rotationRad": 0,
      "flippedX": true
    },
    "parameters": {
      "lowRange": 0.6,
      "highRange": 3,
      "lowResolution": 0.02,
      "highResolution": 0.1,
      "resistanceOhm": 0
    }
  },
  {
    "id": "L1",
    "type": "electrical.lamp",
    "definitionVersion": 1,
    "pose": {
      "xM": -0.3907694042501399,
      "yM": -0.10274489973922375,
      "rotationRad": 0,
      "flippedX": false
    },
    "parameters": {
      "ratedVoltageV": 3,
      "ratedCurrentA": 0.3,
      "coldResistanceOhm": 2,
      "maxCurrentA": 0.9
    }
  },
  {
    "id": "L2",
    "type": "electrical.lamp",
    "definitionVersion": 1,
    "pose": {
      "xM": 0.008655088631181085,
      "yM": -0.11032653298563164,
      "rotationRad": 0,
      "flippedX": false
    },
    "parameters": {
      "ratedVoltageV": 6,
      "ratedCurrentA": 0.3,
      "coldResistanceOhm": 4,
      "maxCurrentA": 0.9
    }
  }
];
export const seriesReferenceConnections: Connection[][] = [
  [
    {
      "id": "series-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": -0.5645874158400542,
          "y": -0.11064612975972797
        },
        {
          "x": -0.3151457094178841,
          "y": -0.3656189159689737
        }
      ]
    },
    {
      "id": "series-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "b"
      },
      "to": {
        "equipmentId": "L2",
        "portId": "a"
      }
    },
    {
      "id": "series-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "to": {
        "equipmentId": "S",
        "portId": "b"
      }
    },
    {
      "id": "series-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.1,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.12
        }
      ]
    },
    {
      "id": "series-wire-4",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "to": {
        "equipmentId": "A",
        "portId": "common"
      },
      "routeWorldM": [
        {
          "x": -0.4205363841583039,
          "y": -0.2031420553659045
        },
        {
          "x": -0.04145472183790827,
          "y": -0.24711552819507038
        }
      ]
    }
  ],
  [
    {
      "id": "series-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.519593323458754,
          "y": 0.03154571130714233
        },
        {
          "x": -0.6100865296735652,
          "y": -0.058947494907668915
        }
      ]
    },
    {
      "id": "series-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "A",
        "portId": "common"
      },
      "to": {
        "equipmentId": "L2",
        "portId": "a"
      }
    },
    {
      "id": "series-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "to": {
        "equipmentId": "S",
        "portId": "b"
      }
    },
    {
      "id": "series-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.1,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.12
        }
      ]
    },
    {
      "id": "series-wire-4",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": -0.3168215095329732,
          "y": -0.29188371090505344
        },
        {
          "x": -0.2732507065406567,
          "y": -0.3857285173500429
        }
      ]
    }
  ],
  [
    {
      "id": "series-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.519593323458754,
          "y": 0.03154571130714233
        },
        {
          "x": -0.6100865296735652,
          "y": -0.058947494907668915
        }
      ]
    },
    {
      "id": "series-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "A",
        "portId": "common"
      },
      "to": {
        "equipmentId": "S",
        "portId": "b"
      },
      "routeWorldM": [
        {
          "x": 0.16413312349759768,
          "y": -0.21312110549586585
        }
      ]
    },
    {
      "id": "series-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.1,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.23
        },
        {
          "x": -0.43,
          "y": 0.12
        }
      ]
    },
    {
      "id": "series-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "b"
      },
      "to": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.23303150377851836,
          "y": -0.11257309859052003
        },
        {
          "x": -0.1458898977938853,
          "y": -0.12262789928105461
        }
      ]
    },
    {
      "id": "series-wire-4",
      "kind": "wire",
      "from": {
        "equipmentId": "A",
        "portId": "low"
      },
      "to": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "routeWorldM": [
        {
          "x": -0.29336030792172585,
          "y": -0.387404317465132
        },
        {
          "x": -0.25146530504449843,
          "y": -0.20306630480533128
        },
        {
          "x": 0.043475515211182675,
          "y": -0.21144530538077677
        }
      ]
    }
  ]
];
