export type Me = { username: string; role: string; location_id: string | null };

export type LocationInfo = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  day_rate: number;
  night_rate: number;
  night_start_time: string;
  open_hour: number;
  close_hour: number;
  weekend_night_start_time: string;
  weekend_open_hour: number;
  weekend_close_hour: number;
  payment_qr_url: string | null;
  payment_account_name: string | null;
  payment_account_number: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  photo_url: string | null;
  accent_color: string | null;
  subscription_due_date: string | null;
  subscription_grace_days: number;
  require_downpayment: boolean;
  downpayment_min_hours: number;
  no_split_rate_booking: boolean;
  allow_half_hour_bookings: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PricingForm = {
  day_rate: string;
  night_rate: string;
  night_start_time: string;
  open_hour: number;
  close_hour: number;
  weekend_night_start_time: string;
  weekend_open_hour: number;
  weekend_close_hour: number;
};

export type DashboardData = {
  stats: {
    today_bookings: number;
    yesterday_bookings: number;
    today_revenue: number;
    yesterday_revenue: number;
    week_revenue: number;
    prev_week_revenue: number;
    month_revenue: number;
    prev_month_revenue: number;
  };
  court_utilization: {
    id: string;
    name: string;
    is_active: boolean;
    booked_hours: number;
    total_hours: number;
    pct: number;
  }[];
  recent_activity: {
    id: string;
    court_name: string;
    booker_name: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
    created_at: string;
  }[];
};
