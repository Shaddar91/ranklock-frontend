//Golden-test fixtures: Infernus base-stats snapshot (patch 2026-08-22) + the exact item rows the
//computeStats goldens reference, captured live from api.ranklock.app. The asserted numbers
//are hand-derived from these values; regenerate if the snapshot changes.
import type { BaseStats, HeroAssetsLike, ItemMods } from './computeStats';

export const INFERNUS_PATCH = "2026-08-22";
export const INFERNUS_BASE: BaseStats = {
  "ability_resource_max": {
    "value": 0
  },
  "ability_resource_regen_per_second": {
    "value": 0
  },
  "air_dash_distance_in_meters": {
    "value": 8.0
  },
  "air_dash_duration": {
    "value": 0.47
  },
  "base_health_regen": {
    "value": 2.0
  },
  "crit_damage_received_scale": {
    "value": 1.0
  },
  "crouch_speed": {
    "value": 4.75
  },
  "ground_dash_distance_in_meters": {
    "value": 10.0
  },
  "ground_dash_duration": {
    "value": 0.68
  },
  "heavy_melee_damage": {
    "value": 116
  },
  "light_melee_damage": {
    "value": 50.0
  },
  "max_health": {
    "value": 830
  },
  "max_move_speed": {
    "value": 6.7
  },
  "move_acceleration": {
    "value": 4.0
  },
  "proc_build_up_rate_scale": {
    "value": 1
  },
  "reload_speed": {
    "value": 1
  },
  "sprint_speed": {
    "value": 1.6
  },
  "stamina": {
    "value": 3
  },
  "stamina_regen_per_second": {
    "value": 0.222222
  },
  "tech_duration": {
    "value": 1
  },
  "tech_range": {
    "value": 1
  },
  "weapon_power": {
    "value": 0
  },
  "weapon_power_scale": {
    "value": 1
  }
};

export const CATALOG: ItemMods[] = [
  {
    "item_id": 915014646,
    "item_name": "Transcendent Cooldown",
    "item_slot_type": "spirit",
    "item_tier": 4,
    "cost": 6400,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_COOLDOWN_REDUCTION_PERCENTAGE",
        "value": 25.0,
        "is_percent": true,
        "label": "Ability Cooldown Reduction"
      },
      {
        "property_type": "MODIFIER_VALUE_ITEM_COOLDOWN_REDUCTION_PERCENTAGE",
        "value": 25.0,
        "is_percent": true,
        "label": "Item Cooldown Reduction"
      },
      {
        "property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
        "value": 4.0,
        "is_percent": false,
        "label": "Out of Combat Regen"
      }
    ]
  },
  {
    "item_id": 3294954488,
    "item_name": "Ballistic Enchantment",
    "item_slot_type": "weapon",
    "item_tier": 3,
    "cost": 3200,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_TECH_RADIUS_PERCENT",
        "value": 22.0,
        "is_percent": true,
        "label": "Radius"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_RANGE_PERCENT",
        "value": 22.0,
        "is_percent": true,
        "label": "Ability Range"
      },
      {
        "property_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
        "value": 20.0,
        "is_percent": true,
        "label": "Weapon Damage per Stack"
      },
      {
        "property_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
        "value": 5.0,
        "is_percent": true,
        "label": "Non-Hero Weapon Damage"
      }
    ]
  },
  {
    "item_id": 2678489038,
    "item_name": "Hollow Point",
    "item_slot_type": "weapon",
    "item_tier": 3,
    "cost": 3200,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
        "value": 35.0,
        "is_percent": true,
        "label": "Weapon Damage"
      },
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 125.0,
        "is_percent": false,
        "label": "Bonus Health"
      },
      {
        "property_type": "MODIFIER_VALUE_BULLET_AND_MELEE_RESIST_REDUCTION",
        "value": -9.0,
        "is_percent": true,
        "label": "Bullet Resist"
      },
      {
        "property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
        "value": 4.5,
        "is_percent": false,
        "label": "Out of Combat Regen"
      }
    ]
  },
  {
    "item_id": 3633614685,
    "item_name": "Extra Health",
    "item_slot_type": "vitality",
    "item_tier": 1,
    "cost": 800,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 210.0,
        "is_percent": false,
        "label": "Bonus Health"
      }
    ]
  },
  {
    "item_id": 1797283378,
    "item_name": "Infuser",
    "item_slot_type": "vitality",
    "item_tier": 4,
    "cost": 6400,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_TECH_LIFESTEAL",
        "value": 70.0,
        "is_percent": true,
        "label": "Spirit Lifesteal"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_LIFESTEAL",
        "value": 13.0,
        "is_percent": true,
        "label": "Spirit Lifesteal"
      },
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 100.0,
        "is_percent": false,
        "label": "Bonus Health"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER",
        "value": 30.0,
        "is_percent": false,
        "label": "Spirit Power"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER",
        "value": 6.0,
        "is_percent": false,
        "label": "Spirit Power"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_RESIST",
        "value": 10.0,
        "is_percent": true,
        "label": "Spirit Resist"
      }
    ]
  },
  {
    "item_id": 2820116164,
    "item_name": "Diviner's Kevlar",
    "item_slot_type": "vitality",
    "item_tier": 4,
    "cost": 6400,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_BONUS_ABILITY_DURATION_PERCENTAGE",
        "value": 15.0,
        "is_percent": true,
        "label": "Ability Duration"
      },
      {
        "property_type": "MODIFIER_VALUE_BARRIER_HEALTH",
        "value": 1000.0,
        "is_percent": false,
        "label": "Barrier"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER",
        "value": 40.0,
        "is_percent": false,
        "label": "Spirit Power"
      }
    ]
  },
  {
    "item_id": 2519598785,
    "item_name": "Boundless Spirit",
    "item_slot_type": "spirit",
    "item_tier": 4,
    "cost": 6400,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 75.0,
        "is_percent": false,
        "label": "Bonus Health"
      },
      {
        "property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
        "value": 4.0,
        "is_percent": false,
        "label": "Out of Combat Regen"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER",
        "value": 30.0,
        "is_percent": false,
        "label": "Spirit Power"
      },
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER_PERCENT",
        "value": 15.0,
        "is_percent": true,
        "label": "Spirit Power"
      }
    ]
  },
  {
    "item_id": 2319629810,
    "item_name": "Shadow Strike",
    "item_slot_type": "vitality",
    "item_tier": 5,
    "cost": 9999,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 350.0,
        "is_percent": false,
        "label": "Bonus Health"
      },
      {
        "property_type": "MODIFIER_VALUE_STAMINA",
        "value": 3.0,
        "is_percent": false,
        "label": "Stamina"
      }
    ]
  },
  {
    "item_id": 3949773228,
    "item_name": "Nullification Burst",
    "item_slot_type": "vitality",
    "item_tier": 5,
    "cost": 9999,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX",
        "value": 300.0,
        "is_percent": false,
        "label": "Bonus Health"
      },
      {
        "property_type": "MODIFIER_VALUE_INVALID",
        "value": -1.0,
        "is_percent": false,
        "label": ""
      },
      {
        "property_type": "MODIFIER_VALUE_STATUS_RESISTANCE",
        "value": 40.0,
        "is_percent": true,
        "label": "Debuff Resist"
      }
    ]
  },
  {
    "item_id": 365620721,
    "item_name": "Glass Cannon",
    "item_slot_type": "weapon",
    "item_tier": 4,
    "cost": 6400,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
        "value": 80.0,
        "is_percent": true,
        "label": "Weapon Damage"
      },
      {
        "property_type": "MODIFIER_VALUE_FIRE_RATE",
        "value": 7.0,
        "is_percent": true,
        "label": "Fire Rate per Kill"
      },
      {
        "property_type": "MODIFIER_VALUE_HEALTH_MAX_PERCENT",
        "value": -13.0,
        "is_percent": true,
        "label": "Max Health"
      },
      {
        "property_type": "MODIFIER_VALUE_MOVEMENT_SPEED_SLOW_PERCENT",
        "value": 30.0,
        "is_percent": true,
        "label": "Bullet Slow Proc"
      }
    ]
  },
  {
    "item_id": 3261353684,
    "item_name": "Superior Cooldown",
    "item_slot_type": "spirit",
    "item_tier": 3,
    "cost": 3200,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_COOLDOWN_REDUCTION_PERCENTAGE",
        "value": 20.0,
        "is_percent": true,
        "label": "Ability Cooldown Reduction"
      },
      {
        "property_type": "MODIFIER_VALUE_OUT_OF_COMBAT_HEALTH_REGEN",
        "value": 4.0,
        "is_percent": false,
        "label": "Out of Combat Regen"
      }
    ]
  },
  {
    "item_id": 968099481,
    "item_name": "Extra Spirit",
    "item_slot_type": "spirit",
    "item_tier": 1,
    "cost": 800,
    "modifiers": [
      {
        "property_type": "MODIFIER_VALUE_TECH_POWER",
        "value": 10.0,
        "is_percent": false,
        "label": "Spirit Power"
      }
    ]
  }
];

//The investment track + per-level scaling the same live snapshot serves on /heroes/1/assets
//(probed 2026-09-12): 11 thresholds ending 22,400/28,800, the 4,800 spike, and the 8,000 step
//the design's 13-tick track got wrong.
export const INFERNUS_ASSETS: HeroAssetsLike = {
  "cost_bonuses": {
    "spirit": [
      {
        "bonus": 7.0,
        "gold_threshold": 800,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 11.0,
        "gold_threshold": 1600,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 15.0,
        "gold_threshold": 2400,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 19.0,
        "gold_threshold": 3200,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 38.0,
        "gold_threshold": 4800,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 45.0,
        "gold_threshold": 6400,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 52.0,
        "gold_threshold": 8000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 59.0,
        "gold_threshold": 11200,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 66.0,
        "gold_threshold": 16000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 75.0,
        "gold_threshold": 22400,
        "percent_on_graph": 11.0
      },
      {
        "bonus": 100.0,
        "gold_threshold": 28800,
        "percent_on_graph": 11.0
      }
    ],
    "vitality": [
      {
        "bonus": 9.0,
        "gold_threshold": 800,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 12.0,
        "gold_threshold": 1600,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 15.0,
        "gold_threshold": 2400,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 20.0,
        "gold_threshold": 3200,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 38.0,
        "gold_threshold": 4800,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 42.0,
        "gold_threshold": 6400,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 46.0,
        "gold_threshold": 8000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 50.0,
        "gold_threshold": 11200,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 54.0,
        "gold_threshold": 16000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 60.0,
        "gold_threshold": 22400,
        "percent_on_graph": 11.0
      },
      {
        "bonus": 66.0,
        "gold_threshold": 28800,
        "percent_on_graph": 11.0
      }
    ],
    "weapon": [
      {
        "bonus": 9.0,
        "gold_threshold": 800,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 12.0,
        "gold_threshold": 1600,
        "percent_on_graph": 7.0
      },
      {
        "bonus": 15.0,
        "gold_threshold": 2400,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 18.0,
        "gold_threshold": 3200,
        "percent_on_graph": 8.0
      },
      {
        "bonus": 46.0,
        "gold_threshold": 4800,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 54.0,
        "gold_threshold": 6400,
        "percent_on_graph": 9.0
      },
      {
        "bonus": 62.0,
        "gold_threshold": 8000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 74.0,
        "gold_threshold": 11200,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 86.0,
        "gold_threshold": 16000,
        "percent_on_graph": 10.0
      },
      {
        "bonus": 100.0,
        "gold_threshold": 22400,
        "percent_on_graph": 11.0
      },
      {
        "bonus": 115.0,
        "gold_threshold": 28800,
        "percent_on_graph": 11.0
      }
    ]
  },
  "purchase_bonuses": {
    "spirit": [
      {
        "tier": 1,
        "value": "4",
        "value_type": "MODIFIER_VALUE_TECH_POWER"
      },
      {
        "tier": 2,
        "value": "7",
        "value_type": "MODIFIER_VALUE_TECH_POWER"
      },
      {
        "tier": 3,
        "value": "10",
        "value_type": "MODIFIER_VALUE_TECH_POWER"
      },
      {
        "tier": 4,
        "value": "13",
        "value_type": "MODIFIER_VALUE_TECH_POWER"
      },
      {
        "tier": 5,
        "value": "16",
        "value_type": "MODIFIER_VALUE_TECH_POWER"
      }
    ],
    "vitality": [
      {
        "tier": 1,
        "value": "7",
        "value_type": "MODIFIER_VALUE_BASE_HEALTH_PERCENT"
      },
      {
        "tier": 2,
        "value": "8",
        "value_type": "MODIFIER_VALUE_BASE_HEALTH_PERCENT"
      },
      {
        "tier": 3,
        "value": "9",
        "value_type": "MODIFIER_VALUE_BASE_HEALTH_PERCENT"
      },
      {
        "tier": 4,
        "value": "10",
        "value_type": "MODIFIER_VALUE_BASE_HEALTH_PERCENT"
      },
      {
        "tier": 5,
        "value": "11",
        "value_type": "MODIFIER_VALUE_BASE_HEALTH_PERCENT"
      }
    ],
    "weapon": [
      {
        "tier": 1,
        "value": "4",
        "value_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE"
      },
      {
        "tier": 2,
        "value": "8",
        "value_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE"
      },
      {
        "tier": 3,
        "value": "13",
        "value_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE"
      },
      {
        "tier": 4,
        "value": "18",
        "value_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE"
      },
      {
        "tier": 5,
        "value": "23",
        "value_type": "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE"
      }
    ]
  },
  "standard_level_up_upgrades": {
    "MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL": 0.088,
    "MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL_ALT_FIRE": 0.0,
    "MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL": 39.0,
    "MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL": 1.58,
    "MODIFIER_VALUE_BONUS_ATTACK_RANGE": 0.0,
    "MODIFIER_VALUE_BOON_COUNT": 1.0,
    "MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST": 0.0,
    "MODIFIER_VALUE_TECH_DAMAGE_MULTIPLIER": 0.0,
    "MODIFIER_VALUE_TECH_POWER": 1.1,
    "MODIFIER_VALUE_TECH_RESIST": 0.0
  }
};
