export type LoyaltyProgress = {requiredVisits: number; discountPercent: number; visits: number; rewardsRedeemed: number};
export type LoyaltyCard = {id: string; required_visits: number; discount_percent: number; created_at: string; redeemed_at: string | null; redemption_appointment_id: number | null; original_price: number | null; discount_amount: number | null};
export type LoyaltyVisit = {appointment_id: number; card_id: string; earned_at: string};
