# E-Learning Platform — Backend Endpoints + SQL Schema (Single Source)

This document describes the full current frontend functionality and the backend requirements to support it (REST endpoints + SQL schema). The current app uses localStorage-backed services that are intentionally “backend-ready”; you can swap each service method to call these endpoints.

## 1) Roles & access

- **Student**: browse courses, add to cart, checkout, enroll, consume content, track progress, attempt quizzes, manage profile/subscription/payment methods.
- **Instructor**: apply to become an instructor; once approved can create/manage courses (future).
- **Admin**: manage instructor applications; manage courses/users (future).

### Auth model assumptions

- Auth is token-based (JWT access token + refresh token).
- All “my/\*” endpoints use the authenticated user; do not accept email from client.

---

## 2) Feature inventory (what exists in the frontend today)

### Learning

- Course list & details
- Course Content player (video/article/quiz)
- Progress tracking per user+course+lesson
  - Video completion only when genuinely watched (watched-time threshold + ended)
  - Quiz completion based on submission
- Enrolled Courses dashboard

### Commerce

- Cart per user
- Coupon apply (per item / order)
- Checkout (saved card or new card)
- Payment record creation
- Enrollment creation after payment

### Account

- Profile editing (name, etc.)
- Payment Methods CRUD (save/remove)
- Subscription (plan/status/org metadata)

### Admin

- Instructor application review: approve/reject

---

## 3) REST API endpoints

Base URL: `/api/v1`

### 3.1 Auth

- `POST /auth/register`

  - body: `{ name, email, password }`
  - returns: `{ user, accessToken, refreshToken }`

- `POST /auth/login`

  - body: `{ email, password }`
  - returns: `{ user, accessToken, refreshToken }`

- `POST /auth/refresh`

  - body: `{ refreshToken }`
  - returns: `{ accessToken, refreshToken }`

- `POST /auth/logout`
  - body: `{ refreshToken }`
  - returns: `204`

### 3.2 Users / Profile

- `GET /me`

  - returns: `{ id, name, email, role, createdAt }`

- `PATCH /me`
  - body: `{ name?, profilePhotoUrl?, ... }`
  - returns: updated user

### 3.3 Courses

- `GET /courses`

  - query: `search?`, `category?`, `page?`, `pageSize?`
  - returns: `{ items: CourseSummary[], total }`

- `GET /courses/:courseId`

  - returns: `CourseDetail`

- `GET /courses/:courseId/lessons`
  - returns: `Lesson[]` (includes type/video URLs/quiz payload metadata)

**Course fields (minimum)**

- `CourseSummary`: `{ id, title, subtitle?, instructorName, priceCents, currency, isFree, isMandatory, thumbnailUrl? }`
- `CourseDetail`: above + `{ description, objectives?, requirements?, totalLessons?, totalDurationSeconds? }`

### 3.4 Enrollments

- `GET /me/enrollments`

  - returns: `Enrollment[]`

- `POST /me/enrollments`

  - body: `{ courseId, paymentId }`
  - returns: created `Enrollment`

- `GET /me/enrollments/:courseId`
  - returns: `{ courseId, status, enrolledAt, accessEndsAt? }`

Enrollment example:

- `{ id, userId, courseId, status: 'active'|'completed'|'expired', enrolledAt, accessEndsAt? }`

### 3.5 Progress (course + lesson)

- `GET /me/courses/:courseId/progress`

  - returns: `CourseProgress`

- `PUT /me/courses/:courseId/lessons/:lessonId/progress`

  - body: `{ watchedSeconds?, durationSeconds?, completed?, completedAt?, lastPositionSeconds? }`
  - returns: updated `LessonProgress`

- `POST /me/courses/:courseId/lessons/:lessonId/complete`
  - returns: updated `LessonProgress`

**Notes**

- Backend should validate that the user is enrolled in the course.
- For videos, backend can accept client progress but can also enforce rate limits, monotonic watched time, and integrity checks.

### 3.6 Quiz

- `GET /courses/:courseId/lessons/:lessonId/quiz`

  - returns quiz definition (questions/options)

- `POST /me/courses/:courseId/lessons/:lessonId/quiz/attempts`
  - body: `{ answers: { questionId, optionId }[] }`
  - returns: `{ attemptId, score, maxScore, passed, breakdown? }`

### 3.7 Cart

- `GET /me/cart`

  - returns: `{ items: CartItem[] }`

- `POST /me/cart/items`

  - body: `{ courseId, quantity? }`
  - returns: updated cart

- `DELETE /me/cart/items/:courseId`

  - returns: updated cart

- `DELETE /me/cart`
  - clears cart

CartItem: `{ courseId, priceCentsAtAdd, currency, addedAt }`

### 3.8 Coupons

- `POST /coupons/validate`

  - body: `{ code, courseId? }`
  - returns: `{ valid, type: 'percent'|'fixed', percentOff?, amountOffCents?, appliesToCourseId?, message? }`

- `POST /me/coupons/redeem`
  - body: `{ code, paymentIntentId? }`
  - returns: `{ redeemed: true }`

### 3.9 Payments

- `GET /me/payment-methods`

  - returns: `PaymentMethod[]`

- `POST /me/payment-methods`

  - body: `{ brand, last4, expMonth, expYear, token }`
  - returns: created method

- `DELETE /me/payment-methods/:paymentMethodId`

  - returns: `204`

- `POST /me/payments`
  - body: `{ amountCents, currency, cartCourseIds: string[], couponCode? , paymentMethodId? , paymentToken? }`
  - returns: `{ id, status, amountCents, currency, createdAt }`

Payment status: `pending|succeeded|failed|refunded`

### 3.10 Subscription

- `GET /me/subscription`

  - returns: `{ planId, status, orgName?, orgSize?, renewsAt?, startedAt? }`

- `PUT /me/subscription`
  - body: `{ planId, orgName?, orgSize? }`
  - returns updated subscription

### 3.11 Instructor application + Admin

- `POST /me/instructor-applications`

  - body: `{ bio, expertise, links? }`
  - returns: created application

- `GET /admin/instructor-applications`

  - returns list

- `POST /admin/instructor-applications/:id/approve`

  - returns updated application

- `POST /admin/instructor-applications/:id/reject`
  - body: `{ reason? }`
  - returns updated application

Admin endpoints require `role=admin`.

---

## 4) SQL schema (PostgreSQL flavored)

This schema is normalized and keeps auditability. Adapt types/constraints for MySQL if needed.

### 4.1 users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','instructor','admin')),
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
```

### 4.2 courses

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  instructor_user_id UUID REFERENCES users(id),
  instructor_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_courses_instructor ON courses(instructor_user_id);
```

### 4.3 lessons

```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lesson_type TEXT NOT NULL CHECK (lesson_type IN ('video','article','quiz')),
  content_url TEXT,            -- video URL or article resource
  content_html TEXT,           -- optional for articles
  sort_order INTEGER NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lessons_course_order ON lessons(course_id, sort_order);
```

### 4.4 enrollments

```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active','completed','expired')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_ends_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
```

### 4.5 lesson_progress

```sql
CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  last_position_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_course ON lesson_progress(user_id, course_id);
```

### 4.6 quizzes, questions, options, attempts

```sql
CREATE TABLE quizzes (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, lesson_id)
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE quiz_options (
  id UUID PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
```

### 4.7 cart_items

```sql
CREATE TABLE cart_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  price_cents_at_add INTEGER NOT NULL,
  currency TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_cart_items_user ON cart_items(user_id);
```

### 4.8 coupons + redemptions

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent','fixed')),
  percent_off INTEGER,
  amount_off_cents INTEGER,
  applies_to_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);
```

### 4.9 payments

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand TEXT NOT NULL,
  last4 TEXT NOT NULL,
  exp_month INTEGER NOT NULL,
  exp_year INTEGER NOT NULL,
  provider_payment_method_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  coupon_code TEXT,
  provider_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON payments(user_id);
```

### 4.10 subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','past_due','canceled')),
  org_name TEXT,
  org_size TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renews_at TIMESTAMPTZ
);
```

### 4.11 instructor_applications

```sql
CREATE TABLE instructor_applications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL,
  expertise TEXT NOT NULL,
  links TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instructor_app_status ON instructor_applications(status);
```

---

## 5) Frontend service → backend mapping (swap points)

These are the seams where localStorage services should call the backend instead.

- `AuthService`: `/auth/*`, `/me`
- `CourseService`: `/courses`, `/courses/:id`, `/courses/:id/lessons`
- `EnrollmentService`: `/me/enrollments`
- `CourseProgressService`: `/me/courses/:courseId/progress` + `/me/courses/:courseId/lessons/:lessonId/progress`
- `CartService`: `/me/cart`
- `CouponService`: `/coupons/validate`, `/me/coupons/redeem`
- `PaymentService`: `/me/payment-methods`, `/me/payments`
- `SubscriptionService`: `/me/subscription`
- `InstructorApplicationService` (or equivalent): `/me/instructor-applications`
- Admin: `/admin/instructor-applications/*`

---

## 6) Notes & constraints

- A browser app cannot truly prevent OS-level screenshots/screen recording; use deterrents + DRM/secure streaming for stronger protection.
- Progress integrity can be improved server-side (monotonic watchedSeconds, suspicious seeking patterns, rate-limits).
- For payments, integrate a real PSP (Stripe/Razorpay) and store only tokens/ids (never raw card data).

---

## Appendix A) Local development (frontend)

From the project root:

- Start dev server: `ng serve` (then open `http://localhost:4200/`)
- Production build: `ng build` (output in `dist/`)
- Unit tests: `ng test`
