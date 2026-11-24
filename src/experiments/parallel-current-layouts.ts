import type { EquipmentInstance } from '../core/equipment/schema.ts';
import type { Connection } from '../core/connections/schema.ts';

export const parallelReferenceEquipment: EquipmentInstance[] = [
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
      "voltageV": 3
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
      "xM": 0.22993961716142203,
      "yM": -0.12561922592339447,
      "rotationRad": 0,
      "flippedX": false
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
      "xM": -0.18,
      "yM": -0.08,
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
      "xM": -0.17614787758892198,
      "yM": -0.28468268826949544,
      "rotationRad": 0,
      "flippedX": false
    },
    "parameters": {
      "ratedVoltageV": 3,
      "ratedCurrentA": 0.2,
      "coldResistanceOhm": 2,
      "maxCurrentA": 0.9
    }
  }
];

export const parallelReferenceConnections: Connection[][] = [
  [
    {
      "id": "parallel-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "S",
        "portId": "a"
      }
    },
    {
      "id": "parallel-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": 0.4158792817653281,
          "y": 0.0060433505761106
        },
        {
          "x": 0.40155149358646347,
          "y": -0.21910760652033434
        }
      ]
    },
    {
      "id": "parallel-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.47449041220697685,
          "y": -0.20477981834146966
        },
        {
          "x": -0.49700550791662135,
          "y": -0.03694001396048344
        }
      ]
    },
    {
      "id": "parallel-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.3168847422394654,
          "y": -0.17407741510104535
        }
      ]
    },
    {
      "id": "parallel-wire-4",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "common"
      },
      "routeWorldM": [
        {
          "x": -0.006877345298628261,
          "y": -0.09746866562601093
        },
        {
          "x": 0.0842933267687456,
          "y": -0.13928135809523112
        }
      ]
    },
    {
      "id": "parallel-wire-5",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "common"
      },
      "routeWorldM": [
        {
          "x": 0.11201236547257587,
          "y": -0.26121481624160725
        }
      ]
    }
  ],
  [
    {
      "id": "parallel-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "S",
        "portId": "a"
      }
    },
    {
      "id": "parallel-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": 0.4158792817653281,
          "y": 0.0060433505761106
        },
        {
          "x": 0.40155149358646347,
          "y": -0.21910760652033434
        }
      ]
    },
    {
      "id": "parallel-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.47449041220697685,
          "y": -0.20477981834146966
        },
        {
          "x": -0.49700550791662135,
          "y": -0.03694001396048344
        }
      ]
    },
    {
      "id": "parallel-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.3168847422394654,
          "y": -0.17407741510104535
        }
      ]
    },
    {
      "id": "parallel-wire-4",
      "kind": "wire",
      "from": {
        "equipmentId": "L1",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "common"
      },
      "routeWorldM": [
        {
          "x": -0.006877345298628261,
          "y": -0.09746866562601093
        },
        {
          "x": 0.0842933267687456,
          "y": -0.13928135809523112
        }
      ]
    },
    {
      "id": "parallel-wire-5",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": 0.11201236547257587,
          "y": -0.26121481624160725
        }
      ]
    }
  ],
  [
    {
      "id": "parallel-wire-0",
      "kind": "wire",
      "from": {
        "equipmentId": "E",
        "portId": "positive"
      },
      "to": {
        "equipmentId": "S",
        "portId": "a"
      }
    },
    {
      "id": "parallel-wire-1",
      "kind": "wire",
      "from": {
        "equipmentId": "S",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "low"
      },
      "routeWorldM": [
        {
          "x": 0.4158792817653281,
          "y": 0.0060433505761106
        },
        {
          "x": 0.40155149358646347,
          "y": -0.21910760652033434
        }
      ]
    },
    {
      "id": "parallel-wire-2",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "E",
        "portId": "negative"
      },
      "routeWorldM": [
        {
          "x": -0.47449041220697685,
          "y": -0.20477981834146966
        },
        {
          "x": -0.49700550791662135,
          "y": -0.03694001396048344
        }
      ]
    },
    {
      "id": "parallel-wire-3",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "a"
      },
      "to": {
        "equipmentId": "L1",
        "portId": "a"
      },
      "routeWorldM": [
        {
          "x": -0.3168847422394654,
          "y": -0.17407741510104535
        }
      ]
    },
    {
      "id": "parallel-wire-4",
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
          "x": -0.006877345298628261,
          "y": -0.09746866562601093
        },
        {
          "x": 0.09248063429952541,
          "y": -0.09220433979324719
        }
      ]
    },
    {
      "id": "parallel-wire-5",
      "kind": "wire",
      "from": {
        "equipmentId": "L2",
        "portId": "b"
      },
      "to": {
        "equipmentId": "A",
        "portId": "common"
      },
      "routeWorldM": [
        {
          "x": 0.11201236547257587,
          "y": -0.26121481624160725
        }
      ]
    }
  ]
];
