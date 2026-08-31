//Golden-test fixtures: Infernus base-stats snapshot (patch 2026-08-22) + the exact item rows the
//computeStats goldens reference, captured live from api.ranklock.app. The asserted numbers
//are hand-derived from these values; regenerate if the snapshot changes.
import type { BaseStats, ItemMods } from './computeStats';

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
