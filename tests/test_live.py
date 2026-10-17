from live.pick import Matcher

M = Matcher()


def pick(h):
    p = M.pick(h)
    return p and (p["sources"][0], p["direction"])


def test_rules_and_negation():
    assert pick("OPEC+ agrees deeper oil production cuts through next year") == ("Oil_Supply", -1)
    assert pick("Fed signals interest rates will stay higher for longer") == ("Interest_Rates", 1)
    assert pick("Williams says Fed may not have to hike rates in 2027") == ("Interest_Rates", -1)


def test_keywords_with_inverse_aliases():
    assert pick("Jobless claims rise to highest level since 2021") == ("Labor_Market", -1)
    assert pick("US inflation rises more than expected") == ("Inflation", 1)
    assert pick("Russia and Ukraine agree to ceasefire talks") == ("Russia_Ukraine_War", -1)


def test_mentions_without_trouble_or_direction_are_skipped():
    assert pick("Taiwan Is Planning $4 Billion Industrial Parks in Texas for Nvidia's Suppliers") is None
    assert pick("Harvard's endowment jumps 27% in fiscal 2026") is None
    assert pick("Marine biologists discover a new species of deep-sea octopus") is None
    assert pick("China holds largest PLA drills around Taiwan in years") == ("Taiwan_Strait_Risk", 1)


def test_checkup_2026_10_17_misreads():
    assert pick("IMF urges support for poorer nations facing high inflation, war spillovers") is None
    assert pick("BOJ may need to tighten faster if inflation beats forecast, IMF says") is None
    assert pick("Epic teams up with Amazon Pharmacy, LillyDirect and Mark Cuban to launch prescription drug pricing tool") is None
    assert pick("OpenAI Accelerates Ad Sprint With Meta Hires, Slashed Prices") is None
    assert pick("After Muse Launch, U.S. Banks Are Saying Hell No to AI Agents Moving Money") is None
    p = M.pick("Fuel-price surge turbocharges global EV sales and spells end for diesel in Europe")
    assert p["sources"] == ["EVs_and_Autonomy"] and p["direction"] == 1
