# Modern Hebrew word-frequency lists, lemmatisers, and the Hebrew-specific pitfalls

Researched 2026-09-28. Where a figure says "measured here", I downloaded the file and computed it myself in Python (scratch scripts, not saved to the project). Those figures are reproducible from the linked raw files; everything else is cited.

## 1. What Hebrew frequency lists exist, and what does each count?

### Takeaway
Two free, bundle-ready lists are worth using. **Hermit Dave's FrequencyWords `he`** counts surface forms from OpenSubtitles 2018, has 1.17M types over 167M tokens, and is CC BY-SA 4.0. **Pinto's Frequency Dictionary of Spoken Hebrew (FDOSH)** gives the top 5,000 lemmas from the same subtitle source. It is MIT-licensed, a 157 KB TSV, and ranked by dispersion. heTenTen21 (3.1bn tokens, lemmatised with YAP) is the best written-Hebrew list, but it is behind a Sketch Engine subscription. I found no official ulpan or Ministry of Education core list that can be downloaded.

### Cited Findings

**Hermit Dave, FrequencyWords (`he`)**
- Repo licence: code is MIT and content is CC BY-SA 4.0. It has OpenSubtitles 2016 and 2018 versions, in the format `word count` per line — [GitHub hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords)
- `content/2018/he/` holds `he_50k.txt` (792,853 bytes), `he_full.txt` (19,215,890 bytes) and `he_ignored.txt` (216,109 bytes). Raw download: https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_50k.txt — [GitHub API listing](https://api.github.com/repos/hermitdave/FrequencyWords/contents/content/2018/he)
- Measured here from `he_full.txt`: **1,167,621 distinct forms and 167,395,810 tokens**. The top entries are לא 5.02M, את 4.85M, אני 4.54M, זה 3.97M, אתה 2.21M, מה, הוא, על, לי, של, כן, לך, אבל, יש, שלי, כל, בסדר — [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)
- Measured here, noise in the list: the top 5,000 include subtitle markup and English (`qsubs`, `rlm`, `font`, `color`, `apos`, `the`, `you`, `and`), a vocalised `כֵּן` and `.אני` with punctuation attached. Stray single letters also rank high: ג at rank 34 with 508k, plus ה, צ, ו, י, ב, ר, ל, ד, ש, מ, ק in the top 300. The ג is almost certainly the geresh in ג'ורג', ג'ון and similar names being split at the apostrophe. So the list needs a cleaning pass before use — [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)

**Wiktionary Hebrew frequency list**
- Wiktionary's Hebrew list is built from **OpenSubtitles2012**, split over numbered sub-pages (`/Hebrew/00` … `/Hebrew/38`). It also points to the Hermit Dave 50k lists, which are CC BY-SA 4.0. The counts are of surface forms: the top is לא 732,646, then את 732,495, then אני 676,717 — [Wiktionary:Frequency lists/Hebrew](https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Hebrew); [talk page / OpenSubtitles2012](https://en.wiktionary.org/wiki/Wiktionary_talk:Frequency_lists/Hebrew)
- In practice this is an older, smaller version of the Hermit Dave list, and it is less convenient to download (wiki pages rather than a file).

**FDOSH, Frequency Dictionary of Spoken Hebrew (Juan D. Pinto, UT Austin MA thesis, 2018)**
- It is built from OPUS **OpenSubtitles2018** in its parsed (already lemmatised) XML. Entries are Hebrew **lemmas**, ranked by Gries' deviation-of-proportions usage coefficient (U_DP), with frequency and range figures for each. Licence: MIT. It has a Zenodo DOI badge — [GitHub juandpinto/frequency-dictionary README](https://github.com/juandpinto/frequency-dictionary)
- File: `export/frequency-dictionary.tsv`, 157,637 bytes, 5,000 rows plus a header. Columns: `LEMMA, RANK, DISPERSION, FREQUENCY, RANGE` — [GitHub API](https://api.github.com/repos/juandpinto/frequency-dictionary/contents/export); raw: https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/export/frequency-dictionary.tsv
- The script keeps only `lemma="[א-ת]+"` matches from the OPUS parse and caps the list at 5,000 (`list_size_int = 5000`). So it inherits every decision made by whichever lemmatiser OPUS used — [create-freq-list.py](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/create-freq-list.py)
- It is cited in the L2 literature as a reference list for spoken Hebrew. Abu-Rabiah (2025) used it alongside heTenTen21 and described it as "derived from a corpus of film subtitles" — [Abu-Rabiah 2025, TAPSLA 11(1)](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)
- Measured here, quality problems in FDOSH:
  - **All personal pronouns collapse to הוא.** It is rank 1 at about 121k per million, while אני, אתה and היא do not appear as separate lemmas. This follows the UD Hebrew Treebank convention for pronoun lemmas.
  - The **clitic letters are lemmas**: ה #2, ל #4, ב #7, ש #9, ו #12, מ #17, כ #66.
  - **את** (#3) merges the object marker with "you" (feminine).
  - **בסדר** (beseder, "OK") is split, so **סדר** ranks #27.
  - **הכיל** ("to contain") at #106 is almost certainly **הכל** ("everything") analysed wrongly.
  - A junk entry **והיי** sits at #55.
  - Single letters appear all the way through the list (נ #356, א #372, י #418 … ף #4497), as leftovers from apostrophes and abbreviations.
  - Some inflected forms slip through as separate low-ranked "lemmas": רוצה #3004 (the main entry is רצה #22), לדבר #3005, לאכול #4872, הולך #3945. — [FDOSH TSV](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/export/frequency-dictionary.tsv)

**wordfreq (Robyn Speer)**
- Hebrew has a "large" wordlist built from 5 sources, including Wikipedia, subtitles, news, books, web and Twitter. Code is Apache-licensed and data is CC BY-SA 4.0. The project is in **sunset mode**: it is a snapshot to about 2021 and "unlikely to be updated again". For Arabic and Hebrew it removes combining marks, so niqqud is stripped. There is no documented handling of prefixes, so it counts surface forms — [GitHub rspeer/wordfreq](https://github.com/rspeer/wordfreq); listed in [NNLP-IL Hebrew-Resources](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)

**Leipzig Corpora Collection**
- `heb-il_web_2019` is Israeli web text: 13,168,593 sentences and 199,595,740 tokens. `heb_news_2019` is news: 284,198 sentences and 4,599,519 tokens. Parts can be downloaded — [Leipzig heb-il_web_2019](https://corpora.uni-leipzig.de/en?corpusId=heb-il_web_2019); [Leipzig heb_news_2019](https://corpora.wortschatz-leipzig.de/en?corpusId=heb_news_2019); [download page](https://wortschatz.uni-leipzig.de/en/download/Hebrew)
- Downloads come in several sizes (10K, 30K, 100K … sentences), and each archive holds several files beside the sentences — [HF mirror index imvladikon/leipzig_corpora_collection](https://huggingface.co/datasets/imvladikon/leipzig_corpora_collection)

**heTenTen (Sketch Engine)**
- heTenTen21 has 3.1bn tokens, crawled Nov–Dec 2019, Nov–Dec 2020 and Jan 2021 with SpiderLing, and is **POS-tagged and lemmatised with YAP**. heTenTen14 has 1.061bn tokens. Access needs a subscription (there is a free trial), and the tagged heTenTen14 is academic-only. The corpus page offers no downloadable list — [Sketch Engine heTenTen](https://www.sketchengine.eu/hetenten-hebrew-corpus/)
- Abu-Rabiah (2025) notes that "the open-access version of this list is limited to the top 1,000 most frequent lemmas" and that it includes punctuation — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)

**Psycholinguistic norms**
- **HeLP (Hebrew Lexicon Project)**, Stein et al. 2024, *Behavior Research Methods* 56:8761–8783. It collected lexical-decision data for 10,000 Hebrew words and nonwords and naming data for 5,000 words, and modelled frequency together with Hebrew-specific predictors (Semitic structure, clitics, phonological entropy) — [PubMed 39251528](https://pubmed.ncbi.nlm.nih.gov/39251528/); [Springer](https://link.springer.com/article/10.3758/s13428-024-02502-4)

**Other lists**
- Frequency Dictionary of the **Hebrew Bible** (BYU): 9,375 headwords. It covers Biblical Hebrew, not Modern Hebrew, so it does not fit this app — [BYU](https://hebrew.byu.edu/about-frequency-dictionary)
- Children's corpora: a list of how often Hebrew-speaking preschoolers use words (for AAC core vocabulary). It is a niche resource and I did not examine it — [Taylor & Francis 2023](https://www.tandfonline.com/doi/full/10.1080/07434618.2023.2210671)

### Inferences
- **For bundling, FDOSH is the only ready-made open lemma list I found.** At 157 KB it is small enough to inline in a single-file app. But it needs a correction pass before it can be trusted as a syllabus: split הוא back into the separate pronouns, drop the single-letter rows, re-merge בסדר, fix הכל, and fold stray inflected forms into their lemma.
- The Hermit Dave list is bigger, newer in practice (OpenSubtitles 2018) and licensed permissively enough to bundle with attribution. As a *syllabus* it is poor unless it is lemmatised first (see section 3). CC BY-SA means that a derived list you ship must be shared under the same licence and credited.
- Every open Hebrew frequency resource I found comes from subtitles, Wikipedia or web crawls. None comes from real transcribed Israeli conversation.

### Gaps
- **No official ulpan or Ministry of Education core vocabulary list** turned up online. Searches found ulpan level systems (Alef–Vav, roughly mapped to CEFR) but no downloadable word list — [Ulpan Aviv levels](https://www.ulpanaviv.com/hebrew-levels); [Wikipedia: Ulpan](https://en.wikipedia.org/wiki/Ulpan). A paper on Hebrew proficiency certification against CEFR exists ([ejournals.eu PDF](https://ejournals.eu/pliki_artykulu_czasopisma/pelny_tekst/d06d5c2f-b8fa-484c-a932-5c5ab28bbd89/pobierz)), but the fetch failed on a TLS certificate error, so I could not check whether it gives vocabulary counts per level.
- **Leipzig licence not verified.** The download page is behind an Anubis bot challenge, and the HF mirror states no licence. Whether each archive has a `*-words.txt` frequency file is based on my memory of the format, not checked.
- **MILA (Technion) frequency lists:** not checked. The MILA analyser is listed as GPLv3 and "temporarily down" — [NNLP-IL](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)
- **HebrewPod101 "top words" and Pealim:** not researched. Pealim is a conjugation dictionary, not a frequency list, as far as I know, but I did not verify this.
- **Hebrew Wikipedia word list:** I found no standalone one. wordfreq folds Wikipedia into its blend.
- **HeLP's frequency source:** the article sits behind a Springer login redirect and PubMed showed only a cookie wall, so I could not confirm which corpus its frequency predictor came from, or whether it compared subtitle and written frequencies.

## 2. Subtitle-based or written-based: which better predicts everyday spoken Israeli Hebrew?

### Takeaway
In every language tested, subtitle frequencies predict word-processing times better than book or newspaper frequencies. For Hebrew, the only direct evidence I found is that written (heTenTen21) and subtitle (FDOSH) lemma lists overlap heavily at the top: 91% of heTenTen's top 1,000 appear in FDOSH's top 5,000. No Hebrew SUBTLEX-style validation study came to light. For a learner aiming at conversation, a subtitle list is the better default.

### Cited Findings
- Subtitle-based frequencies "better predict participants' performance in word recognition experiments than frequencies obtained from traditional book and newspaper corpora, possibly because they imitate naturalistic speech". SUBTLEX-UK explains more variance in British Lexicon Project lexical-decision times than both the BNC and SUBTLEX-US — [van Heuven, Mandera, Keuleers & Brysbaert 2014, SUBTLEX-UK, QJEP](https://www.tandfonline.com/doi/full/10.1080/17470218.2013.850521)
- The same result holds for Chinese: subtitle word and character frequencies explain significantly more variance in naming and lexical decision than written-text measures — [Cai & Brysbaert 2010, SUBTLEX-CH, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0010729)
- The same pattern has been replicated for Dutch and Catalan — [Keuleers, Brysbaert & New, SUBTLEX-NL](https://psycho-usmb.fr/boris.new/wp-content/uploads/2021/10/20-Keuleers-Brysbaert-New-Subtlex-NL.pdf); [SUBTLEX-CAT, BRM](https://link.springer.com/article/10.3758/s13428-019-01233-1)
- Hebrew overlap figures (Abu-Rabiah 2025):
  - 58% of heTenTen21's top 1,000 lemmas are in FDOSH's top 1,000, and **91%** are in FDOSH's top 5,000.
  - Against 1,023 lemmas used by Arabic-speaking L2 writers, the top 50 matched heTenTen at 90% and FDOSH at 50%. The top 100 matched at 93% and 89%.
  — [Abu-Rabiah 2025, TAPSLA](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)
- Abu-Rabiah calls FDOSH's subtitle basis "well-justified, as prior studies have demonstrated that subtitle corpora closely mirror conventional spoken language", citing Pinto 2018 — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)
- Measured here: the top of the Hermit Dave subtitle list is conversational (לא, אני, אתה, בסדר, רוצה, יודע, למה, תודה). By contrast, FDOSH shows that subtitles over-represent dramatic and translated-film words: אלוהים ("God") is at #101, מת ("dead") at #99, קדימה ("come on") at #116 — [FDOSH TSV](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/export/frequency-dictionary.tsv)

### Inferences
- OpenSubtitles Hebrew is mostly **translated** foreign (largely American) film and TV, not native Israeli speech. It captures a conversational register better than news or web text, but it carries translationese and genre skew (crime and action words, "God", "dead", "gun"). I did not find a source that measures how much of OpenSubtitles Hebrew is translated. That it is dominated by translation is an inference from how OpenSubtitles works; FDOSH's `movies-info` folder records the original language of each film and could be used to check.
- Practical rule: rank everyday vocabulary by a subtitle lemma list, then review it by hand against the app's own themes, dropping dramatic-genre words that rank high only because of film plots.

### Gaps
- I found no Hebrew-specific study testing subtitle against written frequency as a predictor, i.e. no "SUBTLEX-HE". I could not see which frequency norm HeLP used (paywall).
- I found no corpus of spontaneous spoken Israeli Hebrew with a public frequency list. The Haifa CoSIH / Corpus of Spoken Israeli Hebrew exists as far as I know, but I did not verify its availability.

## 3. How badly does Hebrew morphology distort raw frequency lists, and how is it fixed?

### Takeaway
It distorts them badly. In the subtitle surface-form list, a common noun's total use is split across up to 18 prefixed spellings, and the bare form is often a minority. Examples: עיר ("city") bare is 9% of its uses and ranks #1998 while העיר ranks #477; בית bare is 24%. Among the top 5,000 surface forms, about 2,200 are a prefix plus another listed form. Unvocalised homographs add to this: in isolation, about 23% of Hebrew words are ambiguous. The fix is contextual segmentation plus lemmatisation, which is what Dicta, YAP, HebPipe and Stanza do.

### Cited Findings

**Fragmentation, measured here** on Hermit Dave `he_full.txt`, grouping the bare form with 17 prefix combinations (ה, ב, ל, מ, ו, ש, כ, וה, וב, ול, שה, מה, כש, בה, לה, שב, של):

| Word | Bare form rank | Bare share of total | Largest variant |
|---|---|---|---|
| עיר ("city") | #1998 | 9% | העיר #477 |
| ספר ("book") | #422 | 20% | see homographs below |
| בית ("house") | #262 | 24% | בבית #187, above the bare form |
| חדר ("room") | #711 | 26% | בחדר #528, above the bare form |
| עבודה ("work") | — | 42% | — |
| בוקר ("morning") | — | 42% | — |
| כסף ("money") | — | 51% | — |
| ילד ("child") | — | 55% | — |
| חבר ("friend") | — | 68% | — |

— [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)

**Homographs inside those counts, measured here:**
- **מספר** (#309) is mispar ("number"), mesaper ("tells"), and misefer ("from a book").
- **לספר** (#313) is mostly lesaper ("to tell"), not lasefer ("to the book").
- **אוכל** (#207) is okhel ("food" / "eats") or ukhal ("I will be able").
- **שאוכל** (#804) is she'okhel ("who eats") or she'ukhal ("that I can").

So a naive "strip the prefix and add up" merge is also wrong. — [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)

**Scale of the problem, measured here:**
- 2,212 of the top 5,000 surface forms are a prefix combination attached to another form in the top 50,000.
- Stripping one layer of prefixes reduces the 5,000 forms to about 3,529 distinct bases.
- This heuristic both overcounts (for example מספר → ספר) and undercounts (pronominal suffixes such as שלי / שלך / אותך / אותי are untouched, and verbs stay unlemmatised), so treat it as an order of magnitude only. — [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)

**The literature on the same problem:**
- Hebrew lets several dictionary words sit in one orthographic word; one of Abu-Rabiah's examples is ba'atid (be + ha + atid) ("in the future"). About **23% of Hebrew words are homographic** out of context (Shimron & Sivan 1994). In Abu-Rabiah's L2 corpus, 18,054 orthographic words held **27,407 word forms**, about 1.52 words per orthographic word. — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)
- The standard fix: Abu-Rabiah ran Dicta's morphology tool to add niqqud in context, then segmented, then checked the lemma of every word by hand — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753); [Dicta morph-analysis](https://morph-analysis.dicta.org.il/)
- Clitics have a real processing cost: HeLP found "a drop in performance for words comprising clitics" and better recognition of words that follow Semitic structure — [HeLP, PubMed 39251528](https://pubmed.ncbi.nlm.nih.gov/39251528/)
- Lemmatisation brings its own conventions and errors. The measured FDOSH artefacts listed in section 1 show them: pronouns collapse to הוא, clitic letters become lemmas, בסדר becomes סדר, and הכל becomes הכיל — [FDOSH TSV](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/export/frequency-dictionary.tsv)

### Inferences
- **Binyanim and roots:** a lemma list treats דיבר ("spoke") and דיבור ("speech"), or כתב ("wrote") and הכתיב ("dictated"), as separate items. That is the right unit for a syllabus: Abu-Rabiah argues for lemmas over word families because families "may overestimate learners' knowledge". A root-family layer could be added on top for teaching, but it should not replace the lemma.
- **The practical unit for the app is the lemma, with the clitic particles (ו, ה, ב, ל, מ, ש, כ) and pronominal suffixes taught once as grammar, not counted as vocabulary.** A card for בבית should credit the lemma בית.
- The app already uses the transliteration scheme that makes this concrete: bakheder, ha'ir and la'avoda are one lemma each plus a joined particle.

### Gaps
- I found no published figure for how much Hebrew surface-form lists inflate type counts compared with lemma counts across a whole corpus. The numbers above are my own measurements on one list.

## 4. Lemmatisers and analysers that could be run once, offline, to build a bundled lemma-frequency list

### Takeaway
Best option in 2026: **DictaBERT-parse**, specifically `dicta-il/dictabert-parse` or the faster `dictabert-tiny-parse`. It is CC BY 4.0, runs in Python through Hugging Face `transformers`, and does prefix segmentation, lemmatisation, morphology, parsing and NER in one pass, outputting JSON or UD. Good alternatives are **HebPipe** (pip, Apache 2.0, lemma accuracy 95.23 on UD-HTB) and **Stanza** (lemma accuracy 89.7–92.5). **YAP** is older and heavier: it needs Go and 6 GB of RAM, and its lexicon has its own licence. **hspell** is AGPL and **MILA** is GPL and currently down. Neither is worth it for a one-off job.

### Cited Findings

**DictaBERT-parse (Dicta)**
- Licence CC BY 4.0, about 0.2B parameters. It is called as `model.predict([sentence], tokenizer, output_style='json')` and can also output `'ud'` or `'iahlt_ud'`. Tasks: prefix segmentation, morphological disambiguation, lemmatisation, dependency parsing and NER, with flags to switch heads off (e.g. `do_lex=False`). There is a "tiny" variant for speed and a "large" one for accuracy — [HF dicta-il/dictabert-parse](https://huggingface.co/dicta-il/dictabert-parse); [tiny](https://huggingface.co/dicta-il/dictabert-tiny-parse); [large](https://huggingface.co/dicta-il/dictabert-large-parse); [joint](https://huggingface.co/dicta-il/dictabert-joint)
- Paper: Shmidman et al. 2024, "MRL Parsing Without Tears: The Case of Hebrew". It uses a "flipped pipeline" in which expert classifiers make decisions on whole tokens. It claims a new state of the art in Hebrew POS tagging and dependency parsing and describes the approach as "blazingly fast". The abstract gives no numbers — [arXiv 2403.06970](https://arxiv.org/abs/2403.06970)
- DictaBERT base model: [arXiv 2308.16687](https://arxiv.org/abs/2308.16687). Also available: `dictabert-morph` (CC BY 4.0) and OtoBERT (for suffixed verb forms) — [NNLP-IL list](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)
- Dicta also runs web tools for morphological analysis and niqqud (Nakdan). Abu-Rabiah used these online rather than locally — [Dicta morph-analysis](https://morph-analysis.dicta.org.il/)

**HebPipe (Amir Zeldes)**
- Installed with `pip install hebpipe`, Python 3.5+ on Linux, Windows or macOS, and models download on first run. It does tokenisation, segmentation, POS, morphology, lemmatisation and parsing, and keeps the input string recoverable from its output. Scores on UD-HTB test: tokenisation F1 99.95, POS 96.15, **lemma 95.23**, LAS 87.62. Citation: Zeldes et al. 2022, EMNLP — [GitHub amir-zeldes/HebPipe](https://github.com/amir-zeldes/HebPipe). Licence: Apache 2.0 — [NNLP-IL](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)
- RFTokenizer, from the same author and Apache 2.0, is a standalone morphological segmenter — [NNLP-IL](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)

**Stanza (Stanford)**
- Hebrew models on UD 2.12 (Stanza 1.5.1):

| Model | Words | UPOS | Lemma | LAS |
|---|---|---|---|---|
| HTB (default) | 92.29 | 89.99 | **89.71** | 77.18 |
| IAHLTwiki | 94.61 | 91.69 | **92.51** | 81.19 |

  — [Stanza performance page](https://stanfordnlp.github.io/stanza/performance.html)

**YAP (ONLP Lab, Bar-Ilan / Tsarfaty)**
- Written in Go. The code is Apache 2.0, but the **BGU Lexicon has separate licensing restrictions**. It needs **6 GB RAM** and takes input as one token per line, UTF-8 without BOM or CRLF. It outputs a morphological lattice, a disambiguated lattice, and CoNLL with lemmas. Citation: More et al. 2019, TACL 7:33–48 — [GitHub OnlpLab/yap](https://github.com/OnlpLab/yap)
- YAP is the lemmatiser behind heTenTen21 — [Sketch Engine](https://www.sketchengine.eu/hetenten-hebrew-corpus/)

**hspell, MILA, and plain tokenisers**
- **hspell** is AGPL-3.0. It is a spell checker plus a morphological analyser (gives the possible analyses without choosing one in context), with the HspellPy wrapper. **MILA** morphological analyser: GPLv3, "temporarily down" — [NNLP-IL](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)
- Tokenisers with no lemmatisation: YontiLevin/Hebrew-Tokenizer (MIT) and eyaler/hebrew_tokenizer — [NNLP-IL](https://github.com/NNLP-IL/Hebrew-Resources/blob/master/models_tools_services.rst)

**Ready-parsed corpora**
- OPUS publishes OpenSubtitles2018 in a *parsed* form that already carries a `lemma=` attribute. FDOSH was built on it, so a lemma count can be made without running any tagger yourself — [FDOSH README](https://github.com/juandpinto/frequency-dictionary); [create-freq-list.py](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/create-freq-list.py)

### Inferences
- **A workable one-off pipeline:**
  1. Take a clean subtitle sample. OpenSubtitles Hebrew raw text from OPUS works, with de-duplication and markup removal; or rebuild from the Hermit Dave counts, though counts without context cannot be disambiguated.
  2. Run `dictabert-parse` (or `-tiny-parse` on CPU) sentence by sentence.
  3. Count lemmas, excluding the clitic segments. Keep the pronouns as separate lemmas, overriding the UD convention that maps them all to הוא.
  4. Compute a dispersion measure across files, as FDOSH did.
  5. Ship the top 5–10k as a small JSON.
- The lemmatisation has to be done on **running text**, not on a frequency list. A form list cannot resolve מספר or אוכל because the context is gone. That is the main reason not to "lemmatise the Hermit Dave list" directly.
- Accuracy ceiling: about 90–95% lemma accuracy per token means the top few thousand lemmas will be stable, but the long tail will hold errors like FDOSH's הכיל. A hand-review pass over the part of the list the app actually uses is still needed. That fits George's setup, where his girlfriend spot-checks.

### Gaps
- I found no published CPU throughput figures for dictabert-parse, dictabert-tiny-parse or HebPipe, so I cannot say how long a 10M-token run would take.
- I did not find lemma-accuracy numbers for DictaBERT to compare directly with HebPipe or Stanza (the arXiv abstract gives none).
- I did not verify which tagger OPUS used to produce the OpenSubtitles2018 lemmas. The pronoun-to-הוא convention suggests a UD-HTB-trained model such as UDPipe, but that is an inference.
- Trankit Hebrew: not checked.

## 5. Coverage figures, and how much vocabulary Hebrew comprehension needs

### Takeaway
I found no published Hebrew coverage study. My own measurements put subtitle surface-form coverage at 64.7% for the top 1,000 forms, 85.6% for 10,000, 90.5% for 20,000 and 95.2% for 50,000. FDOSH's lemma figures imply about 81% for 1,000 lemmas and 91% for 5,000, but that is inflated because clitic letters are counted as tokens. Learners with over 1,000 hours of Hebrew instruction produced only about 1,000 lemmas. The widely used 95%/98% coverage thresholds come from English, not Hebrew.

### Cited Findings
- **Surface-form coverage, measured here** (Hermit Dave `he_full.txt`, 167.4M tokens):

| Top N forms | Coverage |
|---|---|
| 1,000 | 64.7% |
| 2,000 | 71.4% |
| 3,000 | 75.2% |
| 5,000 | 79.8% |
| 8,000 | 83.8% |
| 10,000 | 85.6% |
| 20,000 | 90.5% |
| 50,000 | 95.2% |

  — [he_full.txt](https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/he/he_full.txt)

- **Lemma coverage implied by FDOSH, measured here.** The FREQUENCY column sums to 911,208 across the 5,000 rows, which is consistent with counts per million tokens. Cumulative coverage:

| Top N lemmas | Coverage |
|---|---|
| 100 | 59.9% |
| 500 | 75.3% |
| 1,000 | 80.9% |
| 2,000 | 85.9% |
| 3,000 | 88.4% |
| 4,000 | 90.0% |
| 5,000 | 91.1% |

  **Caveat:** the tokens being covered are OPUS segments, so the clitic letters ה, ל, ב, ש, ו, מ and כ alone count for about 15% of tokens, and all pronouns fold into הוא. These figures are therefore not comparable with English word-family coverage figures and flatter the lemma count — [FDOSH TSV](https://raw.githubusercontent.com/juandpinto/frequency-dictionary/master/export/frequency-dictionary.tsv)

- **English benchmarks that are usually borrowed:** 95% lexical coverage is treated as the minimum for comprehension (about 4,000–5,000 word families) and 98% as the level for adequate unassisted reading. Viewing (film and TV) has its own lexical-coverage research — [Cambridge SSLA, "Lexical coverage in L1 and L2 viewing comprehension"](https://www.cambridge.org/core/journals/studies-in-second-language-acquisition/article/lexical-coverage-in-l1-and-l2-viewing-comprehension/DFCA6605076705D5762C98F286D16B27); [Applied Linguistics 45(6), "How does lexical coverage affect the processing of L2 texts?"](https://academic.oup.com/applij/article/45/6/953/7841943)

- **Hebrew L2 vocabulary sizes** (Abu-Rabiah 2025, *Theory and Practice of Second Language Acquisition* 11(1), doi 10.31261/TAPSLA.16594):
  - 156 argumentative essays by Arabic-speaking students entering Israeli higher education (CEFR B1–B2) contained **about 1,023 productive lemmas**, "despite completing over 1,000 hours of formal L2 instruction".
  - 50% of those lemmas were in heTenTen21's top 1,000.
  - The top 20 lemmas made up about 59% of word-form occurrences, and 421 lemmas occurred once.
  - He cites English figures of 10,000–11,000 word families for educated adult native speakers, and 2,000–4,000 for EFL learners after more than 1,000 hours of instruction (Laufer).
  — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)

### Inferences
- Because Hebrew packs particles into the orthographic word, a Hebrew learner who knows the clitics and the top N lemmas probably covers **more** of running text than the surface-form table suggests. The true lemma figure (with clitics as known grammar) likely sits between the surface-form and FDOSH numbers. Roughly 2,000–3,000 lemmas probably cover about 85–90% of subtitle tokens. That is an inference from the two measured lists, not a published figure.
- Reaching 95% seems to need well beyond 5,000 lemmas even in conversational text, much as in English. Frequency order is most useful for the first 2–3k and then gives way to topic-driven choice.

### Gaps
- No peer-reviewed Hebrew coverage study (lemmas needed for 90/95/98% of Hebrew text or subtitles) turned up.
- No Hebrew-specific receptive vocabulary-size test or norm (a Hebrew equivalent of the VST or LexTALE) was found in this pass.

## 6. Research on frequency-based vocabulary teaching for Hebrew

### Takeaway
There is very little. The one directly relevant recent study is Abu-Rabiah (2025), which profiles learner vocabulary against heTenTen21 and FDOSH and argues for targeted high-frequency and academic vocabulary teaching. Pinto (2018) built FDOSH explicitly to address the "scarcity of data" for Hebrew learners. I found no ulpan research on ordering vocabulary by frequency.

### Cited Findings
- Pinto, J. D. (2018), *Creating a frequency dictionary of spoken Hebrew: A reproducible use of technology to overcome scarcity of data*, UT Austin — cited in [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753); materials at [GitHub juandpinto/frequency-dictionary](https://github.com/juandpinto/frequency-dictionary). The README calls it an MA thesis and the citation calls it a doctoral dissertation. That is a small conflict; the README, as the author's own statement, is likelier to be right.
- Abu-Rabiah (2025): the learners showed a "typical vocabulary profile". They used more 1k-band than 2k-band lemmas, more 2k than 3k, and so on. The author concludes that learners even in an immersion setting "may still acquire a limited productive vocabulary (around 1,000 lemmas)" and calls for targeted vocabulary instruction — [Abu-Rabiah 2025](https://journals.us.edu.pl/index.php/TAPSLA/article/download/16594/14696/101753)
- Register as a separate axis: Ravid et al. had 329 expert judges rank more than 3,500 Hebrew adjectives on a 1–5 register scale, noting that "objective frequency does not always provide reliable information" about developmental lexical distribution — [Hebrew adjective lexicons in developmental perspective, Mental Lexicon 11(3)](https://benjamins.com/catalog/ml.11.3.04rav)

### Inferences
- Hebrew L2 pedagogy seems to rest on the English-derived frequency and coverage framework (Nation, Laufer). Laufer is Israeli (University of Haifa), and much of the English L2 vocabulary work was done with Israeli learners, but that work was about English, not Hebrew.
- For the app, register matters as well as frequency. A high-frequency written lemma can be formal (אשר, "which", instead of ש), and a subtitle list shows the reverse bias. Using a subtitle lemma list, reviewed by a native speaker for register, fits the one-native-checker constraint.

### Gaps
- No ulpan or Israeli Ministry of Education study of frequency-ordered vocabulary teaching was found.
- I did not find the full text of the HeLP article, Pinto's thesis, or the CEFR certification paper. Each could hold further Hebrew-specific figures.
