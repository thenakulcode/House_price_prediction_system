import pickle
import json
import numpy as np

__locations = None
__data_columns = None
__model = None


class _SklearnCompatUnpickler(pickle.Unpickler):
    """Map legacy sklearn module paths found in older pickles."""

    _MODULE_RENAMES = {
        "sklearn.linear_model.base": "sklearn.linear_model._base",
    }

    def find_class(self, module, name):
        module = self._MODULE_RENAMES.get(module, module)
        return super().find_class(module, name)


def _load_model_with_compatibility(model_path):
    with open(model_path, "rb") as f:
        try:
            return pickle.load(f)
        except ModuleNotFoundError as e:
            # Older sklearn pickles often reference removed module paths.
            if "sklearn.linear_model.base" not in str(e):
                raise
            f.seek(0)
            return _SklearnCompatUnpickler(f).load()


def get_estimated_price(location, sqft, bhk, bath):
    try:
        loc_index = __data_columns.index(location.lower())
    except ValueError:
        loc_index = -1

    x = np.zeros(len(__data_columns))
    x[0] = sqft
    x[1] = bath
    x[2] = bhk
    if loc_index >= 0:
        x[loc_index] = 1

    return round(float(__model.predict([x])[0]), 2)


def load_saved_artifacts():
    print("Loading saved artifacts...")
    global __data_columns, __locations, __model

    with open("./artifacts/columns.json", "r") as f:
        __data_columns = json.load(f)["data_columns"]
        __locations = __data_columns[3:]

    if __model is None:
        __model = _load_model_with_compatibility("./artifacts/banglore_home_prices_model.pickle")

    print(f"Loaded {len(__locations)} locations.")


def get_location_names():
    return __locations


def get_data_columns():
    return __data_columns
