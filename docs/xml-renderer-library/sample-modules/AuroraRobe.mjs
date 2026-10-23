/** Generated from ItemRenderers/AuroraRobe.xml. Original XML hash: b6ac0457ee4295ae4ff7fd39375e14bbbea91b50a46a7ca5198ca63c9b317642. See README for interpreter limitations. */
export const renderer = {
  "_meta": {
    "name": "AuroraRobe",
    "category": "ItemRenderers",
    "sourceXml": "ItemRenderers/AuroraRobe.xml",
    "family": "particle-heavy-special-effect",
    "matchingItems": [
      {
        "id": 15078,
        "name": "Aurora Robe",
        "slot": 1,
        "slotName": "Shirt"
      }
    ],
    "sourceSha256": "b6ac0457ee4295ae4ff7fd39375e14bbbea91b50a46a7ca5198ca63c9b317642",
    "runtimeNote": "Compiled from uploaded XML; this preserves source values but does not imply every XML operation is implemented by the current planner runtime."
  },
  "sprites": {
    "s_equip": {
      "atlas": "player_cosmetics3.png",
      "sourceFileName": "game/player_cosmetics3.rttex",
      "textureSize": "32",
      "frame": "3,23"
    },
    "s_sparkle": {
      "atlas": "particles11.png",
      "sourceFileName": "game/particles11.rttex",
      "textureSize": "32",
      "frame": "12,29"
    }
  },
  "rules": {
    "tag": "RenderRules",
    "c": [
      {
        "tag": "AddClothingParticles",
        "c": [
          {
            "tag": "ParticleSystemUpdate",
            "a": {
              "name": "ps_Sparkles"
            }
          },
          {
            "tag": "ParticleSystemUpdate",
            "a": {
              "name": "ps_SparklesTrail",
              "onState": "Motion.Move"
            }
          }
        ]
      },
      {
        "tag": "RenderShirt",
        "c": [
          {
            "tag": "SpriteRender",
            "a": {
              "name": "s_equip",
              "alignment": "DOWN_CENTER"
            }
          },
          {
            "tag": "ParticleSystemRender",
            "a": {
              "name": "ps_Sparkles"
            }
          },
          {
            "tag": "ParticleSystemRender",
            "a": {
              "name": "ps_SparklesTrail"
            }
          }
        ]
      }
    ]
  },
  "animations": [
    {
      "tag": "SpriteAnimation",
      "a": {
        "name": "a_equip",
        "autoPlay": "true",
        "sprite": "s_equip",
        "isLoop": "true",
        "animTime": "1200"
      },
      "c": [
        {
          "tag": "Frame",
          "v": "3,23"
        },
        {
          "tag": "Frame",
          "v": "4,23"
        },
        {
          "tag": "Frame",
          "v": "5,23"
        },
        {
          "tag": "Frame",
          "v": "6,23"
        },
        {
          "tag": "Frame",
          "v": "7,23"
        },
        {
          "tag": "Frame",
          "v": "8,23"
        },
        {
          "tag": "Frame",
          "v": "9,23"
        },
        {
          "tag": "Frame",
          "v": "10,23"
        }
      ]
    },
    {
      "tag": "SpriteAnimation",
      "a": {
        "name": "a_sparkle",
        "sprite": "s_sparkle",
        "animTime": "300",
        "autoPlay": "true",
        "isLoop": "true"
      },
      "c": [
        {
          "tag": "Frame",
          "v": "12,29"
        },
        {
          "tag": "Frame",
          "v": "13,29"
        },
        {
          "tag": "Frame",
          "v": "14,29"
        }
      ]
    }
  ],
  "particles": [
    {
      "tag": "ParticleSystem",
      "a": {
        "name": "ps_Sparkles"
      },
      "c": [
        {
          "tag": "Emitter",
          "c": [
            {
              "tag": "Set",
              "a": {
                "name": "offset"
              },
              "v": "0,0"
            },
            {
              "tag": "Set",
              "a": {
                "name": "offsetFacing"
              },
              "v": "true"
            },
            {
              "tag": "Random",
              "a": {
                "name": "emissionInterval",
                "min": "0.4",
                "max": "0.8"
              }
            },
            {
              "tag": "Set",
              "a": {
                "name": "infParticles"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "infLifeTime"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "particlesPerEmission"
              },
              "v": "1"
            },
            {
              "tag": "Set",
              "a": {
                "name": "particlesToEmit"
              },
              "v": "2"
            }
          ]
        },
        {
          "tag": "Particle",
          "c": [
            {
              "tag": "Set",
              "a": {
                "name": "sprite"
              },
              "v": "s_sparkle"
            },
            {
              "tag": "Set",
              "a": {
                "name": "relativeToEmitter"
              },
              "v": "true"
            },
            {
              "tag": "Random",
              "a": {
                "name": "offset",
                "min": "-10, -8",
                "max": "10, -2"
              }
            },
            {
              "tag": "Set",
              "a": {
                "name": "inSpecificOrder"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "blendingMode"
              },
              "v": "PREMULTIPLIED_ALPHA"
            },
            {
              "tag": "Curve",
              "a": {
                "name": "initialAlpha"
              },
              "c": [
                {
                  "tag": "KeyFrame",
                  "v": "0, 0.8"
                },
                {
                  "tag": "KeyFrame",
                  "v": "0.8, 0.8"
                },
                {
                  "tag": "KeyFrame",
                  "v": "1, 0"
                }
              ]
            },
            {
              "tag": "Select",
              "a": {
                "name": "lifeTime",
                "input": "randomNumber"
              },
              "c": [
                {
                  "tag": "Item",
                  "v": "0.3"
                },
                {
                  "tag": "Item",
                  "v": "0.6"
                }
              ]
            },
            {
              "tag": "Random",
              "a": {
                "name": "initialScale",
                "min": "0.5",
                "max": "0.8"
              }
            },
            {
              "tag": "Random",
              "a": {
                "name": "initialAngle",
                "min": "0",
                "max": "360"
              }
            }
          ]
        }
      ]
    },
    {
      "tag": "ParticleSystem",
      "a": {
        "name": "ps_SparklesTrail"
      },
      "c": [
        {
          "tag": "Emitter",
          "c": [
            {
              "tag": "Set",
              "a": {
                "name": "offset"
              },
              "v": "0,0"
            },
            {
              "tag": "Set",
              "a": {
                "name": "offsetFacing"
              },
              "v": "true"
            },
            {
              "tag": "Random",
              "a": {
                "name": "emissionInterval",
                "min": "0.1",
                "max": "0.3"
              }
            },
            {
              "tag": "Set",
              "a": {
                "name": "infParticles"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "infLifeTime"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "particlesPerEmission"
              },
              "v": "2"
            },
            {
              "tag": "Set",
              "a": {
                "name": "particlesToEmit"
              },
              "v": "2"
            }
          ]
        },
        {
          "tag": "Particle",
          "c": [
            {
              "tag": "Set",
              "a": {
                "name": "sprite"
              },
              "v": "s_sparkle"
            },
            {
              "tag": "Random",
              "a": {
                "name": "offset",
                "min": "-18, -8",
                "max": "0, 0"
              }
            },
            {
              "tag": "Set",
              "a": {
                "name": "inSpecificOrder"
              },
              "v": "true"
            },
            {
              "tag": "Set",
              "a": {
                "name": "blendingMode"
              },
              "v": "PREMULTIPLIED_ALPHA"
            },
            {
              "tag": "Curve",
              "a": {
                "name": "initialAlpha"
              },
              "c": [
                {
                  "tag": "KeyFrame",
                  "v": "0, 0.8"
                },
                {
                  "tag": "KeyFrame",
                  "v": "0.8, 0.8"
                },
                {
                  "tag": "KeyFrame",
                  "v": "1, 0"
                }
              ]
            },
            {
              "tag": "Select",
              "a": {
                "name": "lifeTime",
                "input": "randomNumber"
              },
              "c": [
                {
                  "tag": "Item",
                  "v": "0.3"
                },
                {
                  "tag": "Item",
                  "v": "0.6"
                }
              ]
            },
            {
              "tag": "Random",
              "a": {
                "name": "initialScale",
                "min": "0.5",
                "max": "0.8"
              }
            },
            {
              "tag": "Random",
              "a": {
                "name": "initialAngle",
                "min": "0",
                "max": "360"
              }
            }
          ]
        }
      ]
    }
  ],
  "machines": [
    {
      "tag": "StateMachine",
      "a": {
        "name": "Motion"
      },
      "c": [
        {
          "tag": "States",
          "c": [
            {
              "tag": "State",
              "a": {
                "name": "Idle"
              }
            },
            {
              "tag": "State",
              "a": {
                "name": "Move"
              }
            }
          ]
        },
        {
          "tag": "Transitions",
          "c": [
            {
              "tag": "Transition",
              "a": {
                "to": "Idle",
                "from": "Move"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsVariableFloat",
                      "a": {
                        "name": "speed.length",
                        "operator": "Less",
                        "abs": "true"
                      },
                      "v": "0.1"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "Transition",
              "a": {
                "to": "Move",
                "from": "Idle"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsVariableFloat",
                      "a": {
                        "name": "speed.length",
                        "operator": "Greater",
                        "abs": "true"
                      },
                      "v": "0.1"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "variableMap": null,
  "renderOptions": null,
  "renderData": {
    "tag": "Data",
    "c": [
      {
        "tag": "Sprite",
        "a": {
          "name": "s_equip",
          "fileName": "game/player_cosmetics3.rttex",
          "textureSize": "32",
          "frame": "3,23"
        }
      },
      {
        "tag": "Sprite",
        "a": {
          "name": "s_sparkle",
          "fileName": "game/particles11.rttex",
          "textureSize": "32",
          "frame": "12,29"
        }
      },
      {
        "tag": "Animations",
        "c": [
          {
            "tag": "SpriteAnimation",
            "a": {
              "name": "a_equip",
              "autoPlay": "true",
              "sprite": "s_equip",
              "isLoop": "true",
              "animTime": "1200"
            },
            "c": [
              {
                "tag": "Frame",
                "v": "3,23"
              },
              {
                "tag": "Frame",
                "v": "4,23"
              },
              {
                "tag": "Frame",
                "v": "5,23"
              },
              {
                "tag": "Frame",
                "v": "6,23"
              },
              {
                "tag": "Frame",
                "v": "7,23"
              },
              {
                "tag": "Frame",
                "v": "8,23"
              },
              {
                "tag": "Frame",
                "v": "9,23"
              },
              {
                "tag": "Frame",
                "v": "10,23"
              }
            ]
          },
          {
            "tag": "SpriteAnimation",
            "a": {
              "name": "a_sparkle",
              "sprite": "s_sparkle",
              "animTime": "300",
              "autoPlay": "true",
              "isLoop": "true"
            },
            "c": [
              {
                "tag": "Frame",
                "v": "12,29"
              },
              {
                "tag": "Frame",
                "v": "13,29"
              },
              {
                "tag": "Frame",
                "v": "14,29"
              }
            ]
          }
        ]
      },
      {
        "tag": "StateMachines",
        "c": [
          {
            "tag": "StateMachine",
            "a": {
              "name": "Motion"
            },
            "c": [
              {
                "tag": "States",
                "c": [
                  {
                    "tag": "State",
                    "a": {
                      "name": "Idle"
                    }
                  },
                  {
                    "tag": "State",
                    "a": {
                      "name": "Move"
                    }
                  }
                ]
              },
              {
                "tag": "Transitions",
                "c": [
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Idle",
                      "from": "Move"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsVariableFloat",
                            "a": {
                              "name": "speed.length",
                              "operator": "Less",
                              "abs": "true"
                            },
                            "v": "0.1"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Move",
                      "from": "Idle"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsVariableFloat",
                            "a": {
                              "name": "speed.length",
                              "operator": "Greater",
                              "abs": "true"
                            },
                            "v": "0.1"
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "tag": "ParticleSystems",
        "c": [
          {
            "tag": "ParticleSystem",
            "a": {
              "name": "ps_Sparkles"
            },
            "c": [
              {
                "tag": "Emitter",
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "offset"
                    },
                    "v": "0,0"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "offsetFacing"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "emissionInterval",
                      "min": "0.4",
                      "max": "0.8"
                    }
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "infParticles"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "infLifeTime"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "particlesPerEmission"
                    },
                    "v": "1"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "particlesToEmit"
                    },
                    "v": "2"
                  }
                ]
              },
              {
                "tag": "Particle",
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "sprite"
                    },
                    "v": "s_sparkle"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "relativeToEmitter"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "offset",
                      "min": "-10, -8",
                      "max": "10, -2"
                    }
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "inSpecificOrder"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "blendingMode"
                    },
                    "v": "PREMULTIPLIED_ALPHA"
                  },
                  {
                    "tag": "Curve",
                    "a": {
                      "name": "initialAlpha"
                    },
                    "c": [
                      {
                        "tag": "KeyFrame",
                        "v": "0, 0.8"
                      },
                      {
                        "tag": "KeyFrame",
                        "v": "0.8, 0.8"
                      },
                      {
                        "tag": "KeyFrame",
                        "v": "1, 0"
                      }
                    ]
                  },
                  {
                    "tag": "Select",
                    "a": {
                      "name": "lifeTime",
                      "input": "randomNumber"
                    },
                    "c": [
                      {
                        "tag": "Item",
                        "v": "0.3"
                      },
                      {
                        "tag": "Item",
                        "v": "0.6"
                      }
                    ]
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "initialScale",
                      "min": "0.5",
                      "max": "0.8"
                    }
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "initialAngle",
                      "min": "0",
                      "max": "360"
                    }
                  }
                ]
              }
            ]
          },
          {
            "tag": "ParticleSystem",
            "a": {
              "name": "ps_SparklesTrail"
            },
            "c": [
              {
                "tag": "Emitter",
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "offset"
                    },
                    "v": "0,0"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "offsetFacing"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "emissionInterval",
                      "min": "0.1",
                      "max": "0.3"
                    }
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "infParticles"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "infLifeTime"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "particlesPerEmission"
                    },
                    "v": "2"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "particlesToEmit"
                    },
                    "v": "2"
                  }
                ]
              },
              {
                "tag": "Particle",
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "sprite"
                    },
                    "v": "s_sparkle"
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "offset",
                      "min": "-18, -8",
                      "max": "0, 0"
                    }
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "inSpecificOrder"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "blendingMode"
                    },
                    "v": "PREMULTIPLIED_ALPHA"
                  },
                  {
                    "tag": "Curve",
                    "a": {
                      "name": "initialAlpha"
                    },
                    "c": [
                      {
                        "tag": "KeyFrame",
                        "v": "0, 0.8"
                      },
                      {
                        "tag": "KeyFrame",
                        "v": "0.8, 0.8"
                      },
                      {
                        "tag": "KeyFrame",
                        "v": "1, 0"
                      }
                    ]
                  },
                  {
                    "tag": "Select",
                    "a": {
                      "name": "lifeTime",
                      "input": "randomNumber"
                    },
                    "c": [
                      {
                        "tag": "Item",
                        "v": "0.3"
                      },
                      {
                        "tag": "Item",
                        "v": "0.6"
                      }
                    ]
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "initialScale",
                      "min": "0.5",
                      "max": "0.8"
                    }
                  },
                  {
                    "tag": "Random",
                    "a": {
                      "name": "initialAngle",
                      "min": "0",
                      "max": "360"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "sourceTree": {
    "tag": "ItemRenderer",
    "c": [
      {
        "tag": "Data",
        "c": [
          {
            "tag": "Sprite",
            "a": {
              "name": "s_equip",
              "fileName": "game/player_cosmetics3.rttex",
              "textureSize": "32",
              "frame": "3,23"
            }
          },
          {
            "tag": "Sprite",
            "a": {
              "name": "s_sparkle",
              "fileName": "game/particles11.rttex",
              "textureSize": "32",
              "frame": "12,29"
            }
          },
          {
            "tag": "Animations",
            "c": [
              {
                "tag": "SpriteAnimation",
                "a": {
                  "name": "a_equip",
                  "autoPlay": "true",
                  "sprite": "s_equip",
                  "isLoop": "true",
                  "animTime": "1200"
                },
                "c": [
                  {
                    "tag": "Frame",
                    "v": "3,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "4,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "5,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "6,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "7,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "8,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "9,23"
                  },
                  {
                    "tag": "Frame",
                    "v": "10,23"
                  }
                ]
              },
              {
                "tag": "SpriteAnimation",
                "a": {
                  "name": "a_sparkle",
                  "sprite": "s_sparkle",
                  "animTime": "300",
                  "autoPlay": "true",
                  "isLoop": "true"
                },
                "c": [
                  {
                    "tag": "Frame",
                    "v": "12,29"
                  },
                  {
                    "tag": "Frame",
                    "v": "13,29"
                  },
                  {
                    "tag": "Frame",
                    "v": "14,29"
                  }
                ]
              }
            ]
          },
          {
            "tag": "StateMachines",
            "c": [
              {
                "tag": "StateMachine",
                "a": {
                  "name": "Motion"
                },
                "c": [
                  {
                    "tag": "States",
                    "c": [
                      {
                        "tag": "State",
                        "a": {
                          "name": "Idle"
                        }
                      },
                      {
                        "tag": "State",
                        "a": {
                          "name": "Move"
                        }
                      }
                    ]
                  },
                  {
                    "tag": "Transitions",
                    "c": [
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Idle",
                          "from": "Move"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsVariableFloat",
                                "a": {
                                  "name": "speed.length",
                                  "operator": "Less",
                                  "abs": "true"
                                },
                                "v": "0.1"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Move",
                          "from": "Idle"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsVariableFloat",
                                "a": {
                                  "name": "speed.length",
                                  "operator": "Greater",
                                  "abs": "true"
                                },
                                "v": "0.1"
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "tag": "ParticleSystems",
            "c": [
              {
                "tag": "ParticleSystem",
                "a": {
                  "name": "ps_Sparkles"
                },
                "c": [
                  {
                    "tag": "Emitter",
                    "c": [
                      {
                        "tag": "Set",
                        "a": {
                          "name": "offset"
                        },
                        "v": "0,0"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "offsetFacing"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "emissionInterval",
                          "min": "0.4",
                          "max": "0.8"
                        }
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "infParticles"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "infLifeTime"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "particlesPerEmission"
                        },
                        "v": "1"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "particlesToEmit"
                        },
                        "v": "2"
                      }
                    ]
                  },
                  {
                    "tag": "Particle",
                    "c": [
                      {
                        "tag": "Set",
                        "a": {
                          "name": "sprite"
                        },
                        "v": "s_sparkle"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "relativeToEmitter"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "offset",
                          "min": "-10, -8",
                          "max": "10, -2"
                        }
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "inSpecificOrder"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "blendingMode"
                        },
                        "v": "PREMULTIPLIED_ALPHA"
                      },
                      {
                        "tag": "Curve",
                        "a": {
                          "name": "initialAlpha"
                        },
                        "c": [
                          {
                            "tag": "KeyFrame",
                            "v": "0, 0.8"
                          },
                          {
                            "tag": "KeyFrame",
                            "v": "0.8, 0.8"
                          },
                          {
                            "tag": "KeyFrame",
                            "v": "1, 0"
                          }
                        ]
                      },
                      {
                        "tag": "Select",
                        "a": {
                          "name": "lifeTime",
                          "input": "randomNumber"
                        },
                        "c": [
                          {
                            "tag": "Item",
                            "v": "0.3"
                          },
                          {
                            "tag": "Item",
                            "v": "0.6"
                          }
                        ]
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "initialScale",
                          "min": "0.5",
                          "max": "0.8"
                        }
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "initialAngle",
                          "min": "0",
                          "max": "360"
                        }
                      }
                    ]
                  }
                ]
              },
              {
                "tag": "ParticleSystem",
                "a": {
                  "name": "ps_SparklesTrail"
                },
                "c": [
                  {
                    "tag": "Emitter",
                    "c": [
                      {
                        "tag": "Set",
                        "a": {
                          "name": "offset"
                        },
                        "v": "0,0"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "offsetFacing"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "emissionInterval",
                          "min": "0.1",
                          "max": "0.3"
                        }
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "infParticles"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "infLifeTime"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "particlesPerEmission"
                        },
                        "v": "2"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "particlesToEmit"
                        },
                        "v": "2"
                      }
                    ]
                  },
                  {
                    "tag": "Particle",
                    "c": [
                      {
                        "tag": "Set",
                        "a": {
                          "name": "sprite"
                        },
                        "v": "s_sparkle"
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "offset",
                          "min": "-18, -8",
                          "max": "0, 0"
                        }
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "inSpecificOrder"
                        },
                        "v": "true"
                      },
                      {
                        "tag": "Set",
                        "a": {
                          "name": "blendingMode"
                        },
                        "v": "PREMULTIPLIED_ALPHA"
                      },
                      {
                        "tag": "Curve",
                        "a": {
                          "name": "initialAlpha"
                        },
                        "c": [
                          {
                            "tag": "KeyFrame",
                            "v": "0, 0.8"
                          },
                          {
                            "tag": "KeyFrame",
                            "v": "0.8, 0.8"
                          },
                          {
                            "tag": "KeyFrame",
                            "v": "1, 0"
                          }
                        ]
                      },
                      {
                        "tag": "Select",
                        "a": {
                          "name": "lifeTime",
                          "input": "randomNumber"
                        },
                        "c": [
                          {
                            "tag": "Item",
                            "v": "0.3"
                          },
                          {
                            "tag": "Item",
                            "v": "0.6"
                          }
                        ]
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "initialScale",
                          "min": "0.5",
                          "max": "0.8"
                        }
                      },
                      {
                        "tag": "Random",
                        "a": {
                          "name": "initialAngle",
                          "min": "0",
                          "max": "360"
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "tag": "RenderRules",
        "c": [
          {
            "tag": "AddClothingParticles",
            "c": [
              {
                "tag": "ParticleSystemUpdate",
                "a": {
                  "name": "ps_Sparkles"
                }
              },
              {
                "tag": "ParticleSystemUpdate",
                "a": {
                  "name": "ps_SparklesTrail",
                  "onState": "Motion.Move"
                }
              }
            ]
          },
          {
            "tag": "RenderShirt",
            "c": [
              {
                "tag": "SpriteRender",
                "a": {
                  "name": "s_equip",
                  "alignment": "DOWN_CENTER"
                }
              },
              {
                "tag": "ParticleSystemRender",
                "a": {
                  "name": "ps_Sparkles"
                }
              },
              {
                "tag": "ParticleSystemRender",
                "a": {
                  "name": "ps_SparklesTrail"
                }
              }
            ]
          }
        ]
      }
    ]
  }
};
export default renderer;
