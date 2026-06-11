"""
Digital Addiction -- Data Processing Pipeline
Reads the 3 CSV sources, computes all metrics and chart series,
and writes public/data_insights.json for the Next.js dashboard.
Author: Joshua Sanchez (Data Science Engineer)
"""

import json
import os
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

BASE   = os.path.dirname(__file__)
PUBLIC = os.path.join(BASE, '..', 'public')
OUT    = os.path.join(PUBLIC, 'data_insights.json')

os.makedirs(PUBLIC, exist_ok=True)

# ---- 0. Load -----------------------------------------------------------------
print("Loading CSV sources...")
df_country  = pd.read_csv(os.path.join(BASE, 'country_wise_analysis_addiction.csv'))
df_behavior = pd.read_csv(os.path.join(BASE, 'screen_time_behavior.csv'))
df_global   = pd.read_csv(os.path.join(BASE, 'tiktok_instagram_global_100countries.csv'))

print(f"  country_wise : {len(df_country):>5} rows")
print(f"  screen_time  : {len(df_behavior):>5} rows")
print(f"  tiktok_insta : {len(df_global):>5} rows")

# ---- 1. Key Metrics ----------------------------------------------------------
avg_weekday  = df_behavior['weekday_screen_hours'].mean()
avg_weekend  = df_behavior['weekend_screen_hours'].mean()
avg_daily    = (avg_weekday * 5 + avg_weekend * 2) / 7
avg_focus    = df_behavior['focus_span_minutes'].mean()
pct_high     = round((df_global['addiction_level'] == 'High').mean() * 100, 1)

# Pearson r: combined platform minutes -> addiction score (country level)
total_min    = df_country['tiktok_minutes_daily'] + df_country['instagram_minutes_daily']
corr_addiction = float(np.corrcoef(total_min, df_country['addiction_score'])[0,1])
corr_sleep     = float(np.corrcoef(
    df_global['addiction_pressure'].dropna(),
    df_global.loc[df_global['addiction_pressure'].notna(), 'sleep_quality_index']
)[0,1])

key_metrics = {
    "avg_daily_screen_hours": round(avg_daily, 2),
    "avg_focus_span_minutes": round(avg_focus, 1),
    "pct_high_addiction":     pct_high,
    "corr_engagement_addiction": round(corr_addiction, 3),
    "corr_addiction_sleep":      round(corr_sleep, 3),
    "countries_analyzed":     100,
    "total_observations":     len(df_country) + len(df_behavior) + len(df_global),
}

print(f"\nKey metrics:")
for k, v in key_metrics.items():
    print(f"  {k:<35}: {v}")

# ---- 2. TikTok vs Instagram by Year (sampled every 5 yrs) --------------------
py_agg = (
    df_global
    .groupby('year')[['tiktok_minutes_daily', 'instagram_minutes_daily']]
    .mean()
    .reset_index()
)
sample_years = list(range(2015, 2061, 5))
py_agg = py_agg[py_agg['year'].isin(sample_years)].copy()
py_agg.columns = ['year', 'tiktok_minutes', 'instagram_minutes']
py_agg = py_agg.round(1)

tiktok_vs_instagram = py_agg.to_dict('records')

print(f"\nTikTok vs Instagram yearly sample ({len(tiktok_vs_instagram)} points):")
for row in tiktok_vs_instagram[:3]:
    print(f"  {row}")

# ---- 3. Attention Span & Addiction Score by Year ----------------------------
att_agg = (
    df_global
    .groupby('year')[['attention_span_score', 'addiction_score', 'impulsivity_index']]
    .mean()
    .reset_index()
)
att_agg = att_agg[att_agg['year'].isin(sample_years)].copy()
att_agg.columns = ['year', 'attention_span', 'addiction_score', 'impulsivity']
att_agg = att_agg.round(2)
attention_trend = att_agg.to_dict('records')

# ---- 4. Top 5 Countries by Total Platform Exposure (country_wise) -----------
df_country['total_minutes'] = (
    df_country['tiktok_minutes_daily'] + df_country['instagram_minutes_daily']
)
top5 = (
    df_country
    .sort_values('total_minutes', ascending=False)
    .head(5)[['country', 'tiktok_minutes_daily', 'instagram_minutes_daily',
              'total_minutes', 'addiction_score', 'MHRI']]
    .round(1)
    .rename(columns={
        'tiktok_minutes_daily':    'tiktok',
        'instagram_minutes_daily': 'instagram',
        'total_minutes':           'total',
        'addiction_score':         'addiction_score',
    })
    .to_dict('records')
)

print(f"\nTop 5 countries by total platform exposure:")
for r in top5:
    print(f"  {r['country']:<20} total={r['total']:.1f} min/day")

# ---- 5. Top 10 by Addiction Rank (country_wise) -----------------------------
top10 = (
    df_country
    .sort_values('addiction_rank')
    .head(10)[['country', 'addiction_score', 'addiction_rank',
               'tiktok_minutes_daily', 'sleep_hours', 'MHRI']]
    .round(2)
    .to_dict('records')
)

# ---- 6. Focus Span by Age Group (screen_time_behavior) ----------------------
focus_age = (
    df_behavior
    .groupby('age_group')['focus_span_minutes']
    .agg(mean='mean', std='std')
    .reset_index()
    .rename(columns={'mean': 'mean_focus', 'std': 'std_focus'})
    .round(2)
    .to_dict('records')
)

# ---- 7. Screen Hours by Platform (top 6 platforms) --------------------------
plat_focus = (
    df_behavior
    .groupby('platform')['focus_span_minutes']
    .mean()
    .reset_index()
    .rename(columns={'focus_span_minutes': 'mean_focus'})
    .sort_values('mean_focus', ascending=False)
    .head(8)
    .round(2)
    .to_dict('records')
)

# ---- 8. Static Insights (verbatim findings from previous analysis) -----------
insights = [
    {
        "id":    1,
        "icon":  "TrendingUp",
        "stat":  "r = +0.883",
        "color": "blue",
        "title": "Engagement Drives Addiction",
        "body":  "Strong positive correlation between combined TikTok + Instagram daily exposure and the Addiction Score Index across 100 countries."
    },
    {
        "id":    2,
        "icon":  "Brain",
        "stat":  "~18 min",
        "color": "amber",
        "title": "Universal Focus Floor",
        "body":  "Mean focus span stabilizes at 18 minutes across all age groups, from children to seniors — a population-wide cognitive plateau."
    },
    {
        "id":    3,
        "icon":  "Moon",
        "stat":  f"r = {corr_sleep:.3f}",
        "color": "violet",
        "title": "Sleep as Mental Health Bridge",
        "body":  "Addiction pressure inversely predicts sleep quality, identifying disrupted sleep as the primary physiological mediator of digital addiction harm."
    },
    {
        "id":    4,
        "icon":  "AlertTriangle",
        "stat":  f"{pct_high}%",
        "color": "rose",
        "title": "High-Risk Majority",
        "body":  f"{pct_high}% of 10,000 global observations across 100 countries exhibit a High addiction risk classification."
    },
]

# ---- 9. Compile & write JSON ------------------------------------------------
output = {
    "meta": {
        "sources":     ["country_wise_analysis_addiction.csv",
                        "screen_time_behavior.csv",
                        "tiktok_instagram_global_100countries.csv"],
        "total_rows":  key_metrics["total_observations"],
    },
    "key_metrics":            key_metrics,
    "tiktok_vs_instagram":    tiktok_vs_instagram,
    "attention_trend":        attention_trend,
    "top5_platform_exposure": top5,
    "top10_addiction_rank":   top10,
    "focus_by_age":           focus_age,
    "platform_focus":         plat_focus,
    "insights":               insights,
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\n[OK] Wrote {OUT}")
print(f"     tiktok_vs_instagram : {len(tiktok_vs_instagram)} rows")
print(f"     top5_countries      : {[r['country'] for r in top5]}")
print(f"     insights            : {len(insights)}")
