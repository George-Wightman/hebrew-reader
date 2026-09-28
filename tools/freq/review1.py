# Hand review of FDOSH ranks 1-300. D = drop. A list = the app keys this lemma maps to.
# NEW = entries the app's dictionaries lack, glossed here (transliteration in the app's scheme).
D = None
OV = {
  2: D, 4: D, 7: D, 9: D, 12: D, 14: D, 17: D, 66: D, 69: D,           # glued letters, כול, מן
  27: ['בסדר'],                                                        # FDOSH splits beseder
  # Glossed in the app for a sense the list does not mean: אל is "don't" in speech (אל תדאג),
  # אף is "nobody / never" (אף אחד, אף פעם), האם is subtitle-formal, נמצא is "is located".
  35: D, 87: D, 94: D, 161: D,
  55: D, 101: D, 121: D, 122: D, 132: D, 134: D, 139: D, 151: D, 154: D,
  164: D, 181: D, 192: D, 197: D, 236: D, 265: D, 270: D, 274: D, 282: D, 289: D,
  38: ['שם', 'לשים'],
  70: ['חייב'], 80: ['חיים'],
  91: ['שנה'], 263: ['לשנות', 'שונה'],
  99: ['מת', 'למות'],
  100: ['איפה'],
  103: ['מצטער'],
  105: ['הכל'],                                                        # FDOSH reads hakol as hekhil
  112: ['נותן', 'לתת', 'תן'], 153: D,
  116: ['הנה'],
  120: ['יוצא', 'לצאת'],
  141: ['חדש'],
  150: ['לספר', 'סיפר'], 165: ['ספר'],
  169: ['לגרום'],
  177: ['עומד', 'לעמוד'],
  194: ['חוץ'],
  206: ['ביותר'], 209: ['זהו'], 218: ['עבור'], 229: ['מעולם'],
  230: ['להשתמש', 'משתמש', 'השתמש'],
  240: ['אכפת'], 241: ['קודם'], 244: ['כדאי'], 251: D,
  256: ['עין'],
  257: ['מקווה', 'לקוות'],
  261: ['חכה', 'לחכות', 'מחכה'], 291: D,
  264: ['להפסיק', 'מפסיק'],
  266: ['מודה'],
  268: ['לעלות'],
  290: ['גברת'], 292: ['נוסף'], 295: ['חזרה'], 300: D,
}
NEW = {
  'חייב': ('khayav', 'must / owe (m)'),
  'חיים': ('khayim', 'life'),
  'מת': ('met', 'dead / died; crazy about (מת על)'),
  'מצטער': ('mitzta\'er', 'sorry (m)'),
  'הנה': ('hine', 'here is / look'),
  'יוצא': ('yotze', 'go(es) out (m)'),
  'עומד': ('omed', 'stand(s) (m); about to'),
  'ביותר': ('beyoter', 'the most'),
  'זהו': ('zehu', 'that\'s it'),
  'עבור': ('avur', 'for (the sake of)'),
  'מעולם': ('me\'olam', 'ever (מעולם לא = never)'),
  'אכפת': ('ikhpat', 'care (אכפת לי = I care)'),
  'קודם': ('kodem', 'first / before'),
  'כדאי': ('kedai', 'worth it / should'),
  'לעולם': ('le\'olam', 'ever / forever'),
  'להפסיק': ('lehafsik', 'to stop'),
  'מפסיק': ('mafsik', 'stop(s) (m)'),
  'גברת': ('gveret', 'Mrs / ma\'am / lady'),
  'נוסף': ('nosaf', 'additional / another'),
  'חזרה': ('khazara', 'back (returning)'),
}
