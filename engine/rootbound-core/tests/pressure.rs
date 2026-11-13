use rootbound_core::{PressureConfig, PressureField, TileCoord, TileType};

/// Small, fast pressure profile for deterministic math in tests:
/// radius 2, half-life per tile.
fn test_config() -> PressureConfig {
    PressureConfig {
        source_strength: 10.0,
        decay: 0.5,
        radius: 2,
        full_darkness_pressure: 8.0,
        threat_threshold: 4.0,
        type_weights: [1.0; 5],
    }
}

fn coord(gx: i32, gy: i32) -> TileCoord {
    TileCoord::new(gx, gy)
}

const EPSILON: f32 = 1e-4;

fn assert_approx(actual: f32, expected: f32) {
    assert!(
        (actual - expected).abs() < EPSILON,
        "expected {expected}, got {actual}"
    );
}

#[test]
fn a_source_emits_pressure_at_its_own_cell() {
    let mut field = PressureField::with_size(test_config(), 16);
    assert!(field.add_source(coord(4, 4), TileType::Stem));

    assert_approx(field.pressure_at(coord(4, 4)), 10.0);
    assert_eq!(field.source_count(), 1);
}

#[test]
fn pressure_decays_with_distance_and_vanishes_beyond_the_radius() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(8, 8), TileType::Stem);

    assert_approx(field.pressure_at(coord(9, 8)), 5.0); // 1 tile away
    assert_approx(field.pressure_at(coord(10, 8)), 2.5); // 2 tiles away
    assert_approx(field.pressure_at(coord(8, 9)), 5.0);

    // sqrt(2) away: strictly weaker than 1 tile away.
    let diagonal = field.pressure_at(coord(9, 9));
    assert!(diagonal < 5.0 && diagonal > 1.0);

    // sqrt(5) > radius 2: exactly zero.
    assert_eq!(field.pressure_at(coord(10, 9)), 0.0);
    assert_eq!(field.pressure_at(coord(0, 0)), 0.0);
}

#[test]
fn overlapping_sources_sum() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(4, 4), TileType::Stem);
    field.add_source(coord(8, 4), TileType::Stem);

    // Each source contributes 2.5 at x=6 (2 tiles away from both sides).
    assert_approx(field.pressure_at(coord(6, 4)), 5.0);
}

#[test]
fn type_weights_scale_source_strength() {
    let mut config = test_config();
    config.type_weights = [1.0, 1.0, 2.0, 1.0, 1.0]; // roots emit double
    let mut field = PressureField::with_size(config, 16);

    field.add_source(coord(4, 4), TileType::Root);
    assert_approx(field.pressure_at(coord(4, 4)), 20.0);
}

#[test]
fn darkness_is_clamped_to_unit_interval() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(4, 4), TileType::Stem);

    let dark = field.darkness_at(coord(4, 4));
    assert_eq!(dark, 1.0); // 10 pressure vs full_darkness_pressure of 8

    let mut bright_config = test_config();
    bright_config.full_darkness_pressure = 100.0;
    let mut bright_field = PressureField::with_size(bright_config, 16);
    bright_field.add_source(coord(4, 4), TileType::Stem);
    assert_approx(bright_field.darkness_at(coord(4, 4)), 0.1);

    assert_eq!(field.darkness_at(coord(0, 0)), 0.0);
}

#[test]
fn removing_a_source_reclaims_its_pressure() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(4, 4), TileType::Stem);
    let before = field.total_pressure();

    assert!(field.remove_source(coord(4, 4)));
    assert!(!field.remove_source(coord(4, 4)));
    assert_eq!(field.pressure_at(coord(4, 4)), 0.0);
    assert_eq!(field.total_pressure(), 0.0);
    assert!(field.total_pressure() < before);
}

#[test]
fn out_of_bounds_sources_are_rejected() {
    let mut field = PressureField::with_size(test_config(), 16);
    assert!(!field.add_source(coord(-1, 0), TileType::Stem));
    assert!(!field.add_source(coord(16, 0), TileType::Stem));
    assert_eq!(field.source_count(), 0);
}

#[test]
fn threat_peaks_find_a_cluster_per_separated_hotspot() {
    let mut field = PressureField::with_size(test_config(), 32);
    field.add_source(coord(4, 4), TileType::Stem);
    field.add_source(coord(24, 24), TileType::Stem);

    let peaks = field.threat_peaks();
    assert_eq!(peaks.len(), 2);
    assert!(peaks.iter().all(|peak| peak.max_pressure >= 10.0 - EPSILON));
    assert!(peaks.iter().all(|peak| peak.cells == 5)); // plus-shape: center + 4 arms
}

#[test]
fn adjacent_sources_merge_into_one_peak() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(4, 4), TileType::Stem);
    field.add_source(coord(5, 4), TileType::Stem);

    let peaks = field.threat_peaks();
    assert_eq!(peaks.len(), 1);
    assert_approx(peaks[0].max_pressure, 15.0);
    assert_eq!(peaks[0].cells, 8);
}

#[test]
fn peaks_are_ordered_by_peak_pressure_descending() {
    let mut config = test_config();
    config.type_weights = [1.0, 1.0, 3.0, 1.0, 1.0]; // roots emit triple
    let mut field = PressureField::with_size(config, 32);
    field.add_source(coord(4, 4), TileType::Root); // 30 pressure
    field.add_source(coord(24, 24), TileType::Stem); // 10 pressure

    let peaks = field.threat_peaks();
    assert_eq!(peaks.len(), 2);
    assert!(peaks[0].max_pressure >= peaks[1].max_pressure);
    assert_approx(peaks[0].max_pressure, 30.0);
}

#[test]
fn empty_field_reports_no_peaks_and_zero_pressure() {
    let field = PressureField::with_size(test_config(), 16);
    assert_eq!(field.threat_peaks(), Vec::new());
    assert_eq!(field.max_pressure(), 0.0);
    assert_eq!(field.total_pressure(), 0.0);
    assert_eq!(field.source_count(), 0);
}

#[test]
fn clear_resets_sources_and_cells() {
    let mut field = PressureField::with_size(test_config(), 16);
    field.add_source(coord(4, 4), TileType::Stem);
    field.clear();

    assert_eq!(field.source_count(), 0);
    assert_eq!(field.total_pressure(), 0.0);
    assert_eq!(field.max_pressure(), 0.0);
}

#[test]
fn outside_coordinates_read_as_zero_darkness() {
    let field = PressureField::with_size(test_config(), 16);
    assert_eq!(field.pressure_at(coord(-1, -1)), 0.0);
    assert_eq!(field.darkness_at(coord(999, 999)), 0.0);
}
