/** Generated from ItemRenderers/MightyEagle.xml. Original XML hash: 53fdc8aa5b7dc30e443478f58ebe15b76a642025aaed17e1ff81c0f4186cc02e. See README for interpreter limitations. */
export const renderer = {
  "_meta": {
    "name": "MightyEagle",
    "category": "ItemRenderers",
    "sourceXml": "ItemRenderers/MightyEagle.xml",
    "family": "specialized-item",
    "matchingItems": [
      {
        "id": 14914,
        "name": "Mighty Eagle",
        "slot": 5,
        "slotName": "Hand"
      }
    ],
    "sourceSha256": "53fdc8aa5b7dc30e443478f58ebe15b76a642025aaed17e1ff81c0f4186cc02e",
    "runtimeNote": "Compiled from uploaded XML; this preserves source values but does not imply every XML operation is implemented by the current planner runtime."
  },
  "sprites": {
    "s_Glove": {
      "atlas": "player_cosmetics3.png",
      "sourceFileName": "game/player_cosmetics3.rttex",
      "textureSize": "32",
      "frame": "15,22"
    },
    "s_Pet": {
      "atlas": "p_leag.png",
      "sourceFileName": "game/pets/p_leag.rttex",
      "textureSize": "32",
      "frame": "0,0"
    },
    "s_PetPunch": {
      "atlas": "p_leag.png",
      "sourceFileName": "game/pets/p_leag.rttex",
      "textureSize": "32",
      "frame": "0,0"
    }
  },
  "rules": {
    "tag": "RenderRules",
    "c": [
      {
        "tag": "RenderHandItem",
        "c": [
          {
            "tag": "SpriteRender",
            "a": {
              "flip": "0,0",
              "name": "s_Glove",
              "offset": "0,16",
              "rotateOffset": "true",
              "rotationPoint": "0,1"
            }
          }
        ]
      },
      {
        "tag": "RenderPet",
        "c": [
          {
            "tag": "SpriteRender",
            "a": {
              "name": "s_Pet",
              "offset": "0,-6",
              "onState": "Player.Idle|Player.Sleep|Player.Dance|Player.Move"
            }
          },
          {
            "tag": "SpriteRender",
            "a": {
              "name": "s_PetPunch",
              "offset": "0,-6",
              "onState": "Player.Punch"
            }
          }
        ]
      },
      {
        "tag": "Update",
        "c": [
          {
            "tag": "AvatarTransform",
            "a": {
              "class": "ArmAngle",
              "onState": "Player.Idle"
            },
            "c": [
              {
                "tag": "Set",
                "a": {
                  "name": "armName"
                },
                "v": "arm2Angle"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "armAngle"
                },
                "v": "90"
              }
            ]
          }
        ]
      },
      {
        "tag": "UpdatePet",
        "c": [
          {
            "tag": "ContextUpdate",
            "a": {
              "type": "SetPetFlySit"
            },
            "c": [
              {
                "tag": "Set",
                "a": {
                  "name": "PetFlySit.speed"
                },
                "v": "100"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "PetFlySit.offset"
                },
                "v": "-12,-14"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "PetFlySit.flyTime"
                },
                "v": "2"
              }
            ]
          }
        ]
      }
    ]
  },
  "animations": [
    {
      "tag": "SpriteAnimation",
      "a": {
        "name": "a_PetIdle",
        "sprite": "s_Pet",
        "animTime": "600",
        "isLoop": "true",
        "playOnState": "Pet.Idle"
      },
      "c": [
        {
          "tag": "Frame",
          "v": "3,0"
        },
        {
          "tag": "Frame",
          "v": "4,0"
        },
        {
          "tag": "Frame",
          "v": "5,0"
        }
      ]
    },
    {
      "tag": "SpriteAnimation",
      "a": {
        "name": "a_PetMoving",
        "sprite": "s_Pet",
        "animTime": "600",
        "isLoop": "true",
        "playOnState": "Pet.Moving"
      },
      "c": [
        {
          "tag": "Frame",
          "v": "0,0"
        },
        {
          "tag": "Frame",
          "v": "1,0"
        },
        {
          "tag": "Frame",
          "v": "2,0"
        }
      ]
    },
    {
      "tag": "SpriteAnimation",
      "a": {
        "name": "a_PetPunch",
        "sprite": "s_PetPunch",
        "animTime": "600",
        "isLoop": "true",
        "playOnState": "Player.Punch"
      },
      "c": [
        {
          "tag": "Frame",
          "v": "0,1"
        },
        {
          "tag": "Frame",
          "v": "1,1"
        },
        {
          "tag": "Frame",
          "v": "2,1"
        }
      ]
    }
  ],
  "particles": [],
  "machines": [
    {
      "tag": "StateMachine",
      "a": {
        "name": "Pet"
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
                "name": "Moving"
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
                "from": "Moving"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsVariableFloat",
                      "a": {
                        "name": "pet.velocity.length",
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
                "to": "Moving",
                "from": "Idle"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsVariableFloat",
                      "a": {
                        "name": "pet.velocity.length",
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
    },
    {
      "tag": "StateMachine",
      "a": {
        "name": "Player"
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
                "name": "Sleep"
              }
            },
            {
              "tag": "State",
              "a": {
                "name": "Punch"
              }
            },
            {
              "tag": "State",
              "a": {
                "name": "Dance"
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
                "to": "Sleep",
                "from": "Idle|Punch|Dance|Move"
              },
              "c": [
                {
                  "tag": "Condition",
                  "a": {
                    "type": "or"
                  },
                  "c": [
                    {
                      "tag": "IsAction",
                      "v": "SLEEP"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "Transition",
              "a": {
                "to": "Idle",
                "from": "Punch|Sleep|Dance|Move"
              },
              "c": [
                {
                  "tag": "Condition",
                  "a": {
                    "type": "and"
                  },
                  "c": [
                    {
                      "tag": "IsVariableFloat",
                      "a": {
                        "name": "speed.length",
                        "operator": "Less",
                        "abs": "true"
                      },
                      "v": "0.1"
                    },
                    {
                      "tag": "IsAction",
                      "a": {
                        "operatorType": "NotEqual"
                      },
                      "v": "PUNCH"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "Transition",
              "a": {
                "to": "Punch",
                "from": "Idle|Sleep|Dance|Move"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsAction",
                      "v": "PUNCH"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "Transition",
              "a": {
                "to": "Dance",
                "from": "Idle|Sleep|Punch|Move"
              },
              "c": [
                {
                  "tag": "Condition",
                  "c": [
                    {
                      "tag": "IsAction",
                      "v": "DANCE"
                    }
                  ]
                }
              ]
            },
            {
              "tag": "Transition",
              "a": {
                "to": "Move",
                "from": "Idle|Sleep|Punch|Dance"
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
  "renderOptions": {
    "tag": "RenderOptions",
    "c": [
      {
        "tag": "Default",
        "c": [
          {
            "tag": "Set",
            "a": {
              "name": "NeedRenderPet"
            },
            "v": "true"
          },
          {
            "tag": "Set",
            "a": {
              "name": "PetOffsetDuplication"
            },
            "v": "-20,0"
          },
          {
            "tag": "Set",
            "a": {
              "name": "UsePetForceFaceTime"
            },
            "v": "false"
          },
          {
            "tag": "Set",
            "a": {
              "name": "IgnorePunchTypeCheck"
            },
            "v": "true"
          },
          {
            "tag": "Set",
            "a": {
              "name": "RenderFrontArmInfected"
            },
            "v": "true"
          },
          {
            "tag": "Set",
            "a": {
              "name": "IncludeAllActions"
            },
            "v": "true"
          }
        ]
      }
    ]
  },
  "renderData": {
    "tag": "Data",
    "c": [
      {
        "tag": "Sprite",
        "a": {
          "name": "s_Glove",
          "fileName": "game/player_cosmetics3.rttex",
          "textureSize": "32",
          "frame": "15,22"
        }
      },
      {
        "tag": "Sprite",
        "a": {
          "name": "s_Pet",
          "fileName": "game/pets/p_leag.rttex",
          "textureSize": "32",
          "frame": "0,0"
        }
      },
      {
        "tag": "Sprite",
        "a": {
          "name": "s_PetPunch",
          "fileName": "game/pets/p_leag.rttex",
          "textureSize": "32",
          "frame": "0,0"
        }
      },
      {
        "tag": "Animations",
        "c": [
          {
            "tag": "SpriteAnimation",
            "a": {
              "name": "a_PetIdle",
              "sprite": "s_Pet",
              "animTime": "600",
              "isLoop": "true",
              "playOnState": "Pet.Idle"
            },
            "c": [
              {
                "tag": "Frame",
                "v": "3,0"
              },
              {
                "tag": "Frame",
                "v": "4,0"
              },
              {
                "tag": "Frame",
                "v": "5,0"
              }
            ]
          },
          {
            "tag": "SpriteAnimation",
            "a": {
              "name": "a_PetMoving",
              "sprite": "s_Pet",
              "animTime": "600",
              "isLoop": "true",
              "playOnState": "Pet.Moving"
            },
            "c": [
              {
                "tag": "Frame",
                "v": "0,0"
              },
              {
                "tag": "Frame",
                "v": "1,0"
              },
              {
                "tag": "Frame",
                "v": "2,0"
              }
            ]
          },
          {
            "tag": "SpriteAnimation",
            "a": {
              "name": "a_PetPunch",
              "sprite": "s_PetPunch",
              "animTime": "600",
              "isLoop": "true",
              "playOnState": "Player.Punch"
            },
            "c": [
              {
                "tag": "Frame",
                "v": "0,1"
              },
              {
                "tag": "Frame",
                "v": "1,1"
              },
              {
                "tag": "Frame",
                "v": "2,1"
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
              "name": "Pet"
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
                      "name": "Moving"
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
                      "from": "Moving"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsVariableFloat",
                            "a": {
                              "name": "pet.velocity.length",
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
                      "to": "Moving",
                      "from": "Idle"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsVariableFloat",
                            "a": {
                              "name": "pet.velocity.length",
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
          },
          {
            "tag": "StateMachine",
            "a": {
              "name": "Player"
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
                      "name": "Sleep"
                    }
                  },
                  {
                    "tag": "State",
                    "a": {
                      "name": "Punch"
                    }
                  },
                  {
                    "tag": "State",
                    "a": {
                      "name": "Dance"
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
                      "to": "Sleep",
                      "from": "Idle|Punch|Dance|Move"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "a": {
                          "type": "or"
                        },
                        "c": [
                          {
                            "tag": "IsAction",
                            "v": "SLEEP"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Idle",
                      "from": "Punch|Sleep|Dance|Move"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "a": {
                          "type": "and"
                        },
                        "c": [
                          {
                            "tag": "IsVariableFloat",
                            "a": {
                              "name": "speed.length",
                              "operator": "Less",
                              "abs": "true"
                            },
                            "v": "0.1"
                          },
                          {
                            "tag": "IsAction",
                            "a": {
                              "operatorType": "NotEqual"
                            },
                            "v": "PUNCH"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Punch",
                      "from": "Idle|Sleep|Dance|Move"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsAction",
                            "v": "PUNCH"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Dance",
                      "from": "Idle|Sleep|Punch|Move"
                    },
                    "c": [
                      {
                        "tag": "Condition",
                        "c": [
                          {
                            "tag": "IsAction",
                            "v": "DANCE"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "tag": "Transition",
                    "a": {
                      "to": "Move",
                      "from": "Idle|Sleep|Punch|Dance"
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
        "tag": "RenderOptions",
        "c": [
          {
            "tag": "Default",
            "c": [
              {
                "tag": "Set",
                "a": {
                  "name": "NeedRenderPet"
                },
                "v": "true"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "PetOffsetDuplication"
                },
                "v": "-20,0"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "UsePetForceFaceTime"
                },
                "v": "false"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "IgnorePunchTypeCheck"
                },
                "v": "true"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "RenderFrontArmInfected"
                },
                "v": "true"
              },
              {
                "tag": "Set",
                "a": {
                  "name": "IncludeAllActions"
                },
                "v": "true"
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
              "name": "s_Glove",
              "fileName": "game/player_cosmetics3.rttex",
              "textureSize": "32",
              "frame": "15,22"
            }
          },
          {
            "tag": "Sprite",
            "a": {
              "name": "s_Pet",
              "fileName": "game/pets/p_leag.rttex",
              "textureSize": "32",
              "frame": "0,0"
            }
          },
          {
            "tag": "Sprite",
            "a": {
              "name": "s_PetPunch",
              "fileName": "game/pets/p_leag.rttex",
              "textureSize": "32",
              "frame": "0,0"
            }
          },
          {
            "tag": "Animations",
            "c": [
              {
                "tag": "SpriteAnimation",
                "a": {
                  "name": "a_PetIdle",
                  "sprite": "s_Pet",
                  "animTime": "600",
                  "isLoop": "true",
                  "playOnState": "Pet.Idle"
                },
                "c": [
                  {
                    "tag": "Frame",
                    "v": "3,0"
                  },
                  {
                    "tag": "Frame",
                    "v": "4,0"
                  },
                  {
                    "tag": "Frame",
                    "v": "5,0"
                  }
                ]
              },
              {
                "tag": "SpriteAnimation",
                "a": {
                  "name": "a_PetMoving",
                  "sprite": "s_Pet",
                  "animTime": "600",
                  "isLoop": "true",
                  "playOnState": "Pet.Moving"
                },
                "c": [
                  {
                    "tag": "Frame",
                    "v": "0,0"
                  },
                  {
                    "tag": "Frame",
                    "v": "1,0"
                  },
                  {
                    "tag": "Frame",
                    "v": "2,0"
                  }
                ]
              },
              {
                "tag": "SpriteAnimation",
                "a": {
                  "name": "a_PetPunch",
                  "sprite": "s_PetPunch",
                  "animTime": "600",
                  "isLoop": "true",
                  "playOnState": "Player.Punch"
                },
                "c": [
                  {
                    "tag": "Frame",
                    "v": "0,1"
                  },
                  {
                    "tag": "Frame",
                    "v": "1,1"
                  },
                  {
                    "tag": "Frame",
                    "v": "2,1"
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
                  "name": "Pet"
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
                          "name": "Moving"
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
                          "from": "Moving"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsVariableFloat",
                                "a": {
                                  "name": "pet.velocity.length",
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
                          "to": "Moving",
                          "from": "Idle"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsVariableFloat",
                                "a": {
                                  "name": "pet.velocity.length",
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
              },
              {
                "tag": "StateMachine",
                "a": {
                  "name": "Player"
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
                          "name": "Sleep"
                        }
                      },
                      {
                        "tag": "State",
                        "a": {
                          "name": "Punch"
                        }
                      },
                      {
                        "tag": "State",
                        "a": {
                          "name": "Dance"
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
                          "to": "Sleep",
                          "from": "Idle|Punch|Dance|Move"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "a": {
                              "type": "or"
                            },
                            "c": [
                              {
                                "tag": "IsAction",
                                "v": "SLEEP"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Idle",
                          "from": "Punch|Sleep|Dance|Move"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "a": {
                              "type": "and"
                            },
                            "c": [
                              {
                                "tag": "IsVariableFloat",
                                "a": {
                                  "name": "speed.length",
                                  "operator": "Less",
                                  "abs": "true"
                                },
                                "v": "0.1"
                              },
                              {
                                "tag": "IsAction",
                                "a": {
                                  "operatorType": "NotEqual"
                                },
                                "v": "PUNCH"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Punch",
                          "from": "Idle|Sleep|Dance|Move"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsAction",
                                "v": "PUNCH"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Dance",
                          "from": "Idle|Sleep|Punch|Move"
                        },
                        "c": [
                          {
                            "tag": "Condition",
                            "c": [
                              {
                                "tag": "IsAction",
                                "v": "DANCE"
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "tag": "Transition",
                        "a": {
                          "to": "Move",
                          "from": "Idle|Sleep|Punch|Dance"
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
            "tag": "RenderOptions",
            "c": [
              {
                "tag": "Default",
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "NeedRenderPet"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "PetOffsetDuplication"
                    },
                    "v": "-20,0"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "UsePetForceFaceTime"
                    },
                    "v": "false"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "IgnorePunchTypeCheck"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "RenderFrontArmInfected"
                    },
                    "v": "true"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "IncludeAllActions"
                    },
                    "v": "true"
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
            "tag": "RenderHandItem",
            "c": [
              {
                "tag": "SpriteRender",
                "a": {
                  "flip": "0,0",
                  "name": "s_Glove",
                  "offset": "0,16",
                  "rotateOffset": "true",
                  "rotationPoint": "0,1"
                }
              }
            ]
          },
          {
            "tag": "RenderPet",
            "c": [
              {
                "tag": "SpriteRender",
                "a": {
                  "name": "s_Pet",
                  "offset": "0,-6",
                  "onState": "Player.Idle|Player.Sleep|Player.Dance|Player.Move"
                }
              },
              {
                "tag": "SpriteRender",
                "a": {
                  "name": "s_PetPunch",
                  "offset": "0,-6",
                  "onState": "Player.Punch"
                }
              }
            ]
          },
          {
            "tag": "Update",
            "c": [
              {
                "tag": "AvatarTransform",
                "a": {
                  "class": "ArmAngle",
                  "onState": "Player.Idle"
                },
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "armName"
                    },
                    "v": "arm2Angle"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "armAngle"
                    },
                    "v": "90"
                  }
                ]
              }
            ]
          },
          {
            "tag": "UpdatePet",
            "c": [
              {
                "tag": "ContextUpdate",
                "a": {
                  "type": "SetPetFlySit"
                },
                "c": [
                  {
                    "tag": "Set",
                    "a": {
                      "name": "PetFlySit.speed"
                    },
                    "v": "100"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "PetFlySit.offset"
                    },
                    "v": "-12,-14"
                  },
                  {
                    "tag": "Set",
                    "a": {
                      "name": "PetFlySit.flyTime"
                    },
                    "v": "2"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};
export default renderer;
