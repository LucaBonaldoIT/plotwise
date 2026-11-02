/**
 * Dataset loading. Real datasets ship in public/data; synthetic ones are generated with a
 * seeded RNG so every visitor sees the same numbers.
 */
import { csvParse, autoType } from 'd3';
import { rng, normalSampler } from './stats.js';

var cache = new Map();
var base = import.meta.env.BASE_URL;

export function loadCsv(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(base + 'data/' + name)
        .then(function (r) {
          if (!r.ok) throw new Error('Could not load ' + name);
          return r.text();
        })
        .then(function (t) {
          return csvParse(t, autoType);
        }),
    );
  }
  return cache.get(name);
}

/* ---- metadata ---------------------------------------------------------- */

export var BANK_ATTRS = [
  { key: 'id', label: 'Id', type: 'id', desc: 'Unique identifier' },
  { key: 'age', label: 'Age', type: 'ratio', desc: 'Customer age in years' },
  { key: 'sex', label: 'Sex', type: 'nominal', desc: 'MALE / FEMALE' },
  { key: 'region', label: 'Region', type: 'nominal', desc: 'INNER_CITY / RURAL / SUBURBAN / TOWN' },
  { key: 'income', label: 'Income', type: 'ratio', desc: 'Customer income' },
  { key: 'married', label: 'Married', type: 'binary', desc: 'Is the customer married? (YES/NO)' },
  { key: 'children', label: 'Children', type: 'ratio', desc: 'Number of children' },
  { key: 'car', label: 'Car', type: 'binary', desc: 'Does she own a car? (YES/NO)' },
  {
    key: 'save_act',
    label: 'Save account',
    type: 'binary',
    desc: 'Does she have a save account? (YES/NO)',
  },
  {
    key: 'current_act',
    label: 'Current account',
    type: 'binary',
    desc: 'Does she have a current account? (YES/NO)',
  },
  {
    key: 'mortgage',
    label: 'Mortgage',
    type: 'binary',
    desc: 'Has she subscribed a mortgage? (YES/NO)',
  },
  {
    key: 'pep',
    label: 'PEP',
    type: 'binary',
    desc: 'Has she purchased a Personal Equity Plan since the last mailing? (YES/NO)',
  },
];

export var TITANIC_ATTRS = [
  { key: 'Survived', label: 'Survived', type: 'binary' },
  { key: 'Pclass', label: 'Class', type: 'ordinal' },
  { key: 'Sex', label: 'Sex', type: 'nominal' },
  { key: 'Age', label: 'Age', type: 'ratio' },
  { key: 'SibSp', label: 'Siblings / spouses', type: 'ratio' },
  { key: 'Parch', label: 'Parents / children', type: 'ratio' },
  { key: 'Fare', label: 'Fare', type: 'ratio' },
  { key: 'Cabin', label: 'Cabin', type: 'nominal' },
  { key: 'Embarked', label: 'Embarked', type: 'nominal' },
];

/* Average consumption, grams per person per week (slides 84–87). */
export var UK_FOOD = {
  countries: ['England', 'N Ireland', 'Scotland', 'Wales'],
  foods: [
    ['Alcoholic drinks', 375, 135, 458, 475],
    ['Beverages', 57, 47, 53, 73],
    ['Carcase meat', 245, 267, 242, 227],
    ['Cereals', 1472, 1494, 1462, 1582],
    ['Cheese', 105, 66, 103, 103],
    ['Confectionery', 54, 41, 62, 64],
    ['Fats and oils', 193, 209, 184, 235],
    ['Fish', 147, 93, 122, 160],
    ['Fresh fruit', 1102, 674, 957, 1137],
    ['Fresh potatoes', 720, 1033, 566, 874],
    ['Fresh Veg', 253, 143, 171, 265],
    ['Other meat', 685, 586, 750, 803],
    ['Other Veg', 488, 355, 418, 570],
    ['Processed potatoes', 198, 187, 220, 203],
    ['Processed Veg', 360, 334, 337, 365],
    ['Soft drinks', 1374, 1506, 1572, 1256],
    ['Sugars', 156, 139, 147, 175],
  ],
};

/* Spatial modeling of politics (slides 89–92). */
export var PARTIES = {
  Progressive: [2, 9, 8, 9, 9, 8, 3, 3, 8, 9],
  Conservative: [9, 3, 4, 3, 3, 4, 9, 9, 4, 3],
  Liberal: [7, 5, 8, 6, 8, 5, 5, 8, 7, 5],
  Populist: [8, 7, 2, 4, 4, 7, 9, 6, 3, 6],
};
export var POLITICS_USER = [6, 6, 7, 4, 5, 3, 4, 4, 7, 4];
export var CITIZENS_SAMPLE = [
  [8, 3, 6, 4, 3, 3, 6, 8, 4, 2],
  [8, 8, 1, 2, 5, 9, 7, 8, 3, 8],
  [4, 5, 4, 7, 9, 2, 4, 2, 7, 8],
  [8, 6, 4, 3, 2, 8, 8, 5, 1, 5],
  [7, 9, 3, 7, 6, 9, 7, 7, 3, 5],
  [9, 8, 2, 6, 3, 8, 7, 5, 1, 6],
  [2, 8, 6, 9, 8, 6, 2, 1, 10, 10],
  [7, 7, 9, 4, 10, 5, 6, 10, 5, 5],
  [4, 8, 8, 9, 8, 9, 3, 4, 7, 8],
  [3, 10, 7, 8, 7, 5, 6, 1, 8, 9],
];

/** Citizens: the ten rows shown in the slides plus synthetic ones scattered around the parties. */
export function citizens(n) {
  var rand = rng(92);
  var g = normalSampler(rand);
  var names = Object.keys(PARTIES);
  var out = CITIZENS_SAMPLE.map(function (r) {
    return r.slice();
  });
  while (out.length < n) {
    var p = PARTIES[names[Math.floor(rand() * names.length)]];
    out.push(
      p.map(function (v) {
        return Math.max(1, Math.min(10, Math.round(v + g() * 1.9)));
      }),
    );
  }
  return out;
}

/** "PCA / t-SNE at work": 4 centroids in 5D, 100 points each (σ = 0.5). */
export var BLOB_CENTERS = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [10, 10, 10, -10, -10],
  [-10, -10, -10, 10, 10],
];

export function blobs(extraNoise) {
  var rand = rng(400);
  var g = normalSampler(rand);
  var rows = [];
  var labels = [];
  BLOB_CENTERS.forEach(function (c, k) {
    for (var i = 0; i < 100; i++) {
      var r = c.map(function (v) {
        return v + g() * 0.5;
      });
      if (extraNoise) {
        r.push(g() * 30, g() * 30);
      }
      rows.push(r);
      labels.push(k);
    }
  });
  return { rows: rows, labels: labels };
}
