# app.py
from flask import Flask, jsonify, render_template, request
import os
import math
import json
import random

app = Flask(__name__, static_folder="static", template_folder="templates")

MAPBOX_TOKEN = os.environ.get("MAPBOX_TOKEN", "pk.eyJ1IjoicGVzaGFsYSIsImEiOiJjbWdiNWRldXkwdXhhMmpzNzlzeTFwa3k1In0.baq6CRqbJ6w9-ywkqDkWMA")




def calculate_deflection(asteroid_data, method_data, time_remaining_days):
    """
    Calculate if deflection mission succeeds
    Returns: (success: bool, deflection_distance_km: float, details: dict)
    """
    # Asteroid properties
    diameter_m = asteroid_data['diameter_km'] * 1000
    velocity_m_s = asteroid_data['velocity_km_s'] * 1000
    density = asteroid_data['density_kg_m3']
    
    # Calculate asteroid mass
    volume = (4/3) * math.pi * (diameter_m/2)**3
    mass_kg = density * volume
    
    # Momentum transfer calculation
    spacecraft_mass = 1000  # kg (typical impactor)
    spacecraft_velocity = 10000  # m/s relative velocity
    
    # Momentum change based on method efficiency
    momentum_transfer = (spacecraft_mass * spacecraft_velocity * 
                        method_data['momentum_efficiency'])
    
    # Velocity change of asteroid (delta-v)
    delta_v = momentum_transfer / mass_kg  # m/s
    
    # Deflection distance after given time
    deflection_distance_m = delta_v * (time_remaining_days * 86400)
    deflection_distance_km = deflection_distance_m / 1000
    
    # Success criteria: deflection must exceed Earth radius (6371 km)
    earth_radius_km = 6371
    success = deflection_distance_km > earth_radius_km
    
    # Calculate success probability based on conditions
    base_probability = 0.7
    
    # Time factor: more time = higher success
    time_factor = min(time_remaining_days / 30, 1.0)
    
    # Size factor: smaller asteroids easier to deflect
    size_factor = max(0.3, 1.0 - (diameter_m / 1000))
    
    # Method-specific risks
    method_risk = {
        'kinetic': 0.85,
        'gravity': 0.95,
        'nuclear': 0.65,  # Higher risk
        'ion': 0.90
    }
    
    final_probability = (base_probability * time_factor * size_factor * 
                        method_risk.get(method_data['id'], 0.7))
    
    # Random success determination
    random_roll = random.random()
    actual_success = random_roll < final_probability and success
    
    return actual_success, deflection_distance_km, {
        'delta_v_m_s': delta_v,
        'probability': final_probability,
        'time_factor': time_factor,
        'size_factor': size_factor
    }


@app.route("/game/scenarios", methods=["GET"])
def get_scenarios():
    """Return all game scenarios"""
    return jsonify(GAME_DATA['scenarios'])


@app.route("/game/methods", methods=["GET"])
def get_methods():
    """Return all deflection methods"""
    return jsonify(GAME_DATA['deflection_methods'])


@app.route("/game/launch", methods=["POST"])
def launch_mission():
    """
    Execute deflection mission
    Expected payload: {
        scenario_id, method_id, impact_lat, impact_lon
    }
    """
    data = request.get_json()
    
    # Find scenario and method
    scenario = next((s for s in GAME_DATA['scenarios'] 
                    if s['id'] == data['scenario_id']), None)
    method = next((m for m in GAME_DATA['deflection_methods'] 
                  if m['id'] == data['method_id']), None)
    
    if not scenario or not method:
        return jsonify({"error": "Invalid scenario or method"}), 400
    
    # Check budget
    if method['cost'] > scenario['budget']:
        return jsonify({"error": "Insufficient budget"}), 400
    
    # Check time constraints
    total_time_needed = method['launch_time_days'] + method['mission_duration_days']
    time_remaining = scenario['asteroid']['discovery_days'] - total_time_needed
    
    if time_remaining < 0:
        return jsonify({"error": "Insufficient time"}), 400
    
    # Calculate deflection outcome
    success, deflection_km, details = calculate_deflection(
        scenario['asteroid'], 
        method, 
        time_remaining
    )
    
    if success:
        # Mission succeeded
        return jsonify({
            "success": True,
            "deflection_distance_km": round(deflection_km, 2),
            "message": f"Asteroid deflected by {deflection_km:.0f} km. Earth is safe!",
            "details": details,
            "score": calculate_score(scenario, method, time_remaining)
        })
    else:
        # Mission failed - run impact simulation
        impact_result = calculate_impact(
            scenario['asteroid']['diameter_km'],
            scenario['asteroid']['velocity_km_s'],
            45,  # default angle
            scenario['asteroid']['density_kg_m3']
        )
        
        # Add population impact
        crater_radius_km = impact_result['crater_d_m'] / 2000
        crater_area_km2 = math.pi * (crater_radius_km ** 2)
        casualties = int(crater_area_km2 * 1000)  # estimate
        
        return jsonify({
            "success": False,
            "impact_data": {
                "crater_d_m": impact_result['crater_d_m'],
                "energy_mt": impact_result['energy_mt'],
                "casualties": casualties
            },
            "message": f"Deflection failed. Impact occurred.",
            "details": details,
            "lat": data['impact_lat'],
            "lon": data['impact_lon']
        })


def calculate_score(scenario, method, time_remaining):
    """Calculate player score"""
    budget_efficiency = (scenario['budget'] - method['cost']) / scenario['budget']
    time_efficiency = time_remaining / scenario['asteroid']['discovery_days']
    
    base_score = 1000
    score = base_score * (1 + budget_efficiency) * (1 + time_efficiency)
    
    return int(score)

@app.route("/")
def index():
    return render_template("index.html", MAPBOX_TOKEN=MAPBOX_TOKEN)


def atmospheric_entry(diameter_m, velocity_m_s, density_kg_m3, angle_rad):
    """
    Atmospheric entry model from Collins et al. (2005)
    Returns: (final_velocity, survived)
    """
    # Constants
    H = 8000  # atmospheric scale height (m)
    rho_surface = 1.225  # air density at surface (kg/m³)
    Cd = 2.0  # drag coefficient
    Y = 2e6  # ablation strength (Pa) - varies by material
    
    # Material-specific ablation strength
    if density_kg_m3 == 1000:  # Ice
        Y = 1e5
    elif density_kg_m3 == 1500:  # Porous rock
        Y = 5e5
    elif density_kg_m3 == 3000:  # Dense rock
        Y = 5e6
    elif density_kg_m3 == 8000:  # Iron
        Y = 5e7
    
    # Impactor properties
    volume = (4/3) * math.pi * (diameter_m/2)**3
    mass = density_kg_m3 * volume
    area = math.pi * (diameter_m/2)**2
    
    # Compute crushing altitude (where dynamic pressure exceeds strength)
    v_entry = velocity_m_s
    crush_altitude = -H * math.log(Y / (rho_surface * v_entry**2))
    
    # If crush_altitude < 0, object reaches ground intact
    if crush_altitude < 0 or mass > 1e9:  # Very large objects
        return velocity_m_s * 0.99, True
    
    # Pancake model for fragmentation
    # Energy loss through atmosphere
    path_length = crush_altitude / math.sin(max(angle_rad, 0.1))
    rho_avg = rho_surface * math.exp(-crush_altitude / (2*H))
    
    # Deceleration
    beta = (Cd * rho_avg * area) / mass
    delta_v = beta * path_length
    
    v_impact = math.sqrt(max(0, velocity_m_s**2 - 2*delta_v))
    
    # Small objects (<10m) may airburst
    if diameter_m < 10:
        return v_impact * 0.5, False
    elif diameter_m < 50:
        return v_impact * 0.7, True
    else:
        return max(v_impact, velocity_m_s * 0.85), True


def crater_diameter_scaling(energy_joules, velocity_m_s, diameter_m, density_projectile, 
                            density_target, angle_rad, g=9.81):
    """
    Crater scaling laws from Collins et al. (2005)
    """
    # Prevent division by zero
    if angle_rad < 0.01:
        angle_rad = 0.01
    
    # Angle correction factor
    sin_angle = math.sin(angle_rad)
    angle_factor = sin_angle ** (1/3)
    
    # Projectile to target density ratio
    rho_ratio = (density_projectile / density_target) ** (1/3)
    
    # Determine scaling regime
    transition_diameter = 100  # meters
    
    if diameter_m < transition_diameter:
        # STRENGTH REGIME (small craters)
        # Target strength for competent rock
        Y_target = 1.8e7  # Pa
        
        # Crater volume from strength scaling
        pi_V = 0.2 * (density_projectile / density_target) * \
               (velocity_m_s**2 / Y_target) * \
               (diameter_m**3)
        
        crater_volume = pi_V
        
        # Convert volume to diameter (assuming hemispherical transient crater)
        crater_d_m = 2 * ((3 * crater_volume) / (2 * math.pi)) ** (1/3)
        
    else:
        # GRAVITY REGIME (large craters)
        # Pi-group scaling
        pi_2 = (g * diameter_m) / (velocity_m_s**2)
        pi_3 = density_projectile / density_target
        
        # Empirical coefficients from Holsapple & Housen (2007)
        K1 = 0.8
        mu = 0.41
        nu = 0.39
        
        # Transient crater diameter
        crater_d_m = diameter_m * K1 * (pi_2 ** (-mu)) * (pi_3 ** nu)
    
    # Apply angle correction
    crater_d_m = crater_d_m * angle_factor
    
    # Simple to complex transition
    D_transition = 3000  # meters
    
    if crater_d_m > D_transition:
        # Complex crater - rim diameter is larger than transient
        # Rim uplift factor
        rim_factor = 1.25
        crater_d_m = crater_d_m * rim_factor
    
    return crater_d_m


def crater_depth(crater_d_m):
    """
    Depth-diameter relationship
    """
    # Simple craters: d/D = 0.2
    # Complex craters: d/D = 0.1 to 0.05
    
    if crater_d_m < 3000:
        # Simple bowl-shaped crater
        return crater_d_m * 0.2
    elif crater_d_m < 20000:
        # Transitional complex crater
        return crater_d_m * 0.12
    else:
        # Large complex crater
        return crater_d_m * 0.08


def calculate_impact(diameter_km, velocity_km_s, angle_deg, density_kg_m3):
    """
    Full impact calculation matching Purdue calculator methodology
    """
    # Constants
    g = 9.81  # m/s²
    density_target = 2500  # kg/m³ (competent rock)
    
    # Unit conversions
    diameter_m = diameter_km * 1000
    velocity_m_s = velocity_km_s * 1000
    angle_rad = math.radians(angle_deg)
    
    # Mass and initial energy
    volume = (4/3) * math.pi * (diameter_m/2)**3
    mass_kg = density_kg_m3 * volume
    energy_initial = 0.5 * mass_kg * velocity_m_s**2
    
    # Atmospheric entry
    velocity_surface, survived = atmospheric_entry(
        diameter_m, velocity_m_s, density_kg_m3, angle_rad
    )
    
    # Final impact energy
    energy_impact = 0.5 * mass_kg * velocity_surface**2
    energy_mt = energy_impact / 4.184e15
    
    # Crater formation
    crater_d_m = crater_diameter_scaling(
        energy_impact, 
        velocity_surface,
        diameter_m,
        density_kg_m3,
        density_target,
        angle_rad,
        g
    )
    
    # Crater depth
    crater_depth_m = crater_depth(crater_d_m)
    
    return {
        "crater_d_m": crater_d_m,
        "crater_depth_m": crater_depth_m,
        "energy_mt": energy_mt,
        "velocity_mph": velocity_km_s * 621.371,
        "velocity_surface_km_s": velocity_surface / 1000,
        "mass_kg": mass_kg,
        "survived_atmosphere": survived
    }


def generate_summary(result, angle_deg, diameter_km, velocity_km_s):
    """Generate impact summary"""
    energy = result["energy_mt"]
    crater_km = result["crater_d_m"] / 1000
    survived = result["survived_atmosphere"]
    
    if not survived:
        return (f"The {diameter_km:.3f} km asteroid disintegrated during atmospheric entry. "
                f"The airburst released approximately {energy:.3f} MT of energy.")
    
    if energy < 0.001:
        energy_desc = "equivalent to a small conventional explosive"
    elif energy < 0.015:
        energy_desc = "comparable to the Hiroshima bomb"
    elif energy < 1:
        energy_desc = f"{energy:.3f} MT, similar to a large thermonuclear weapon"
    elif energy < 50:
        energy_desc = f"{energy:.1f} MT, comparable to the largest nuclear tests"
    elif energy < 10000:
        energy_desc = f"{energy:,.0f} MT, causing regional devastation"
    else:
        energy_desc = f"{energy:,.0f} MT, a mass extinction event"
    
    summary = (
        f"A {diameter_km:.3f} km asteroid traveling at {velocity_km_s:.1f} km/s "
        f"struck at {angle_deg:.0f}°, releasing {energy_desc}. "
        f"The impact crater is {crater_km:.2f} km wide and {result['crater_depth_m']:.0f} m deep."
    )
    
    return summary


@app.route("/simulate", methods=["POST"])
def simulate():
    data = request.get_json()
    
    try:
        diameter_km = float(data.get("diameter_km", 1))
        velocity_km_s = float(data.get("velocity_km_s", 20))
        angle_deg = float(data.get("angle_deg", 45))
        population_density = float(data.get("population_density_per_km2", 100))
        density_kg_m3 = float(data.get("density_kg_m3", 3000))
        
        # Validation
        if not (0.001 <= diameter_km <= 1000):
            return jsonify({"error": "Diameter must be between 0.001 and 1000 km"}), 400
        if not (11 <= velocity_km_s <= 72):
            return jsonify({"error": "Velocity must be between 11 and 72 km/s"}), 400
        if not (0 <= angle_deg <= 90):
            return jsonify({"error": "Angle must be between 0 and 90 degrees"}), 400
        
        # Calculate impact
        result = calculate_impact(diameter_km, velocity_km_s, angle_deg, density_kg_m3)
        
        # Population impact
        crater_radius_km = result["crater_d_m"] / 2000
        crater_area_km2 = math.pi * (crater_radius_km ** 2)
        vaporized_population = int(crater_area_km2 * population_density)
        
        summary_text = generate_summary(result, angle_deg, diameter_km, velocity_km_s)
        
        response = {
            "crater_d_m": round(result["crater_d_m"], 2),
            "crater_depth_m": round(result["crater_depth_m"], 2),
            "velocity_mph": round(result["velocity_mph"], 2),
            "energy_mt": round(result["energy_mt"], 6),
            "vaporized_population": vaporized_population,
            "summary_text": summary_text
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

    from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/game/orbit-guard')
def orbit_guard():
    return render_template('game.html')

if __name__ == '__main__':
    app.run(debug=True)

    from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/game')
def game():
    return render_template('game.html')

if __name__ == '__main__':
    app.run(debug=True)

@app.route("/game")
def game():
    return render_template("game.html")

from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/game')
def game():
    return render_template('game.html')

if __name__ == '__main__':
    app.run(debug=True)
