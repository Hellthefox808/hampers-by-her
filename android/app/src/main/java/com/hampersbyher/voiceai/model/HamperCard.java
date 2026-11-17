package com.hampersbyher.voiceai.model;

import org.json.JSONObject;

/**
 * Model representing a curated luxury hamper suggested by the Voice AI.
 */
public class HamperCard {
    private final String id;
    private final String title;
    private final String priceRupees;
    private final String subtitle;
    private final String badge;
    private final String occasion;

    public HamperCard(String id, String title, String priceRupees, String subtitle, String badge, String occasion) {
        this.id = id;
        this.title = title;
        this.priceRupees = priceRupees;
        this.subtitle = subtitle;
        this.badge = badge != null && !badge.isEmpty() ? badge : "Curated Edit";
        this.occasion = occasion != null ? occasion : "All Occasions";
    }

    public static HamperCard fromJson(JSONObject json) {
        if (json == null) return null;
        String id = json.optString("id", "prod_" + System.currentTimeMillis());
        String title = json.optString("title", "Artisanal Hamper");
        String price = json.optString("priceRupees", "2,450");
        String subtitle = json.optString("subtitle", json.optString("description", "Hand-tied with waxed ribbon"));
        String badge = json.optString("badge", "Atelier Pick");
        String occasion = json.optString("occasion", "Gifting");
        return new HamperCard(id, title, price, subtitle, badge, occasion);
    }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getPriceRupees() { return priceRupees; }
    public String getSubtitle() { return subtitle; }
    public String getBadge() { return badge; }
    public String getOccasion() { return occasion; }
}
