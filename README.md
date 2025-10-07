# Orbit Guard - Asteroid Impact Simulator

An interactive web application that simulates asteroid impacts on Earth and allows users to plan deflection missions to save the planet.

Demo - https://orbit-guard.up.railway.app
## Features

- **Impact Simulator**: Calculate the effects of asteroid impacts on Earth
- **3D Visualization**: Interactive globe with Mapbox integration
- **Deflection Missions**: Plan and execute asteroid deflection scenarios
- **Real NASA Data**: Integration with NASA NEO (Near-Earth Object) API
- **Arcade Game**: Defend Earth in a retro-style shooting game

## Setup Instructions

### Prerequisites
- Python 3.7 or higher
- pip (Python package manager)

### Installation

1. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   ```

2. **Activate the virtual environment:**
   ```bash
   source venv/bin/activate  # On Linux/Mac
   # or
   venv\Scripts\activate  # On Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. **Make sure your virtual environment is activated**

2. **Run the Flask application:**
   ```bash
   python app.py
   # or
   ./venv/bin/python app.py
   ```

3. **Open your browser and navigate to:**
   ```
   http://127.0.0.1:5000
   ```

## Application Routes

- `/` - Main application with impact simulator
- `/game` - Arcade-style defense game
- `/simulate` - API endpoint for impact calculations (POST)
- `/game/scenarios` - Get available deflection scenarios (GET)
- `/game/methods` - Get deflection methods (GET)
- `/game/launch` - Launch deflection mission (POST)

## Configuration

### Mapbox Token
The application uses Mapbox for globe visualization. A default token is included but you can set your own:

```bash
export MAPBOX_TOKEN="your_mapbox_token_here"
```

### NASA API
The application integrates with NASA's NEO API. An API key is included in the JavaScript, but you can get your own free key at:
https://api.nasa.gov/

## Issues Fixed

1. **Missing GAME_DATA Configuration**: Added game scenarios and deflection methods data
2. **Duplicate Flask App Initialization**: Removed duplicate app and route definitions
3. **Missing Requirements File**: Created requirements.txt for easy dependency management

## Technologies Used

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **3D Graphics**: Three.js
- **Maps**: Mapbox GL JS
- **Geospatial**: Turf.js
- **APIs**: NASA NEO API

## Game Scenarios

1. **Apophis Threat 2029** - $5B budget, 6 months warning
2. **Bennu Impact 2182** - $10B budget, 1 year warning  
3. **Didymos Emergency** - $3B budget, 3 months warning (challenging!)

## Deflection Methods

1. **Kinetic Impactor** - DART-style impact ($500M)
2. **Gravity Tractor** - Long-duration gravitational tug ($2B)
3. **Nuclear Standoff** - Nuclear detonation near surface ($3B)
4. **Ion Beam Shepherd** - Ion beam deflection ($1.5B)

## License

Educational/Research Use
