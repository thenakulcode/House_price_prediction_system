from pathlib import Path
import json
import pickle

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import ShuffleSplit, cross_val_score


ROOT_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = ROOT_DIR / "model"
ARTIFACTS_DIR = ROOT_DIR / "artifacts"


def convert_sqft_to_num(x: str):
    tokens = str(x).split("-")
    if len(tokens) == 2:
        return (float(tokens[0]) + float(tokens[1])) / 2
    try:
        return float(x)
    except Exception:
        return None


def remove_pps_outliers(df: pd.DataFrame) -> pd.DataFrame:
    df_out = pd.DataFrame()
    for _, subdf in df.groupby("location"):
        m = np.mean(subdf.price_per_sqft)
        st = np.std(subdf.price_per_sqft)
        reduced_df = subdf[(subdf.price_per_sqft > (m - st)) & (subdf.price_per_sqft <= (m + st))]
        df_out = pd.concat([df_out, reduced_df], ignore_index=True)
    return df_out


def remove_bhk_outliers(df: pd.DataFrame) -> pd.DataFrame:
    exclude_indices = np.array([])
    for _, location_df in df.groupby("location"):
        bhk_stats = {}
        for bhk, bhk_df in location_df.groupby("bhk"):
            bhk_stats[bhk] = {
                "mean": np.mean(bhk_df.price_per_sqft),
                "std": np.std(bhk_df.price_per_sqft),
                "count": bhk_df.shape[0],
            }

        for bhk, bhk_df in location_df.groupby("bhk"):
            stats = bhk_stats.get(bhk - 1)
            if stats and stats["count"] > 5:
                exclude_indices = np.append(
                    exclude_indices,
                    bhk_df[bhk_df.price_per_sqft < stats["mean"]].index.values,
                )

    return df.drop(exclude_indices, axis="index")


def build_training_frame() -> pd.DataFrame:
    source_csv = MODEL_DIR / "bengaluru_house_prices.csv"
    df1 = pd.read_csv(source_csv)

    df2 = df1.drop(["area_type", "society", "balcony", "availability"], axis="columns")
    df3 = df2.dropna().copy()
    df3["bhk"] = df3["size"].apply(lambda x: int(x.split(" ")[0]))

    df4 = df3.copy()
    df4.total_sqft = df4.total_sqft.apply(convert_sqft_to_num)
    df4 = df4[df4.total_sqft.notnull()]

    df5 = df4.copy()
    df5["price_per_sqft"] = df5["price"] * 100000 / df5["total_sqft"]
    df5.location = df5.location.apply(lambda x: x.strip())

    location_stats = df5["location"].value_counts(ascending=False)
    location_stats_less_than_10 = location_stats[location_stats <= 10]
    df5.location = df5.location.apply(
        lambda x: "other" if x in location_stats_less_than_10 else x
    )

    df6 = df5[~(df5.total_sqft / df5.bhk < 300)]
    df7 = remove_pps_outliers(df6)
    df8 = remove_bhk_outliers(df7)
    df9 = df8[df8.bath < df8.bhk + 2]

    df10 = df9.drop(["size", "price_per_sqft"], axis="columns")
    dummies = pd.get_dummies(df10.location)

    if "other" in dummies.columns:
        dummies = dummies.drop("other", axis="columns")

    df11 = pd.concat([df10, dummies], axis="columns")
    df12 = df11.drop("location", axis="columns")
    return df12


def train_and_export() -> None:
    df12 = build_training_frame()

    X = df12.drop(["price"], axis="columns")
    y = df12.price

    model = LinearRegression()
    model.fit(X, y)

    cv = ShuffleSplit(n_splits=5, test_size=0.2, random_state=0)
    scores = cross_val_score(LinearRegression(), X, y, cv=cv)

    columns_payload = {"data_columns": [col.lower() for col in X.columns]}

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    for target in [ARTIFACTS_DIR / "columns.json", MODEL_DIR / "columns.json"]:
        with open(target, "w", encoding="utf-8") as f:
            json.dump(columns_payload, f)

    for target in [
        ARTIFACTS_DIR / "banglore_home_prices_model.pickle",
        MODEL_DIR / "banglore_home_prices_model.pickle",
    ]:
        with open(target, "wb") as f:
            pickle.dump(model, f)

    print(f"Training rows: {len(df12)}")
    print(f"Features: {len(X.columns)}")
    print(f"CV mean score: {scores.mean():.4f}")
    print("Exported model and columns to model/ and artifacts/")


if __name__ == "__main__":
    train_and_export()
