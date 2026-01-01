import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { CartService, CartItem } from '../../services/cart.service';
import { CourseService, AppCourse } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { Coupon, CouponService } from '../../services/coupon.service';
import { PaymentMethod, PaymentService } from '../../services/payment.service';
import { CommerceEventsService } from '../../services/commerce-events.service';
import { CurrencyService } from '../../services/currency.service';
import { ToastService } from '../../services/toast.service';

interface CartCourseItem {
  courseId: string;
  course: AppCourse | null;
  addedAtIso: string;
  isEnrolled: boolean;
}

interface CheckoutLine {
  courseId: string;
  title: string;
  currency: string;
  basePriceCents: number;
  finalPriceCents: number;
  isFree: boolean;
  isEnrolled: boolean;
  couponCode: string;
  coupon?: Coupon;
  couponError?: string;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.css']
})
export class Cart implements OnInit {
  isLoggedIn = false;
  email = '';

  items: CartCourseItem[] = [];

  // Checkout modal
  checkoutOpen = false;
  isProcessing = false;
  checkoutLines: CheckoutLine[] = [];
  methods: PaymentMethod[] = [];
  selectedMethodId = '';

  useNewCard = false;
  saveNewCard = true;
  newCard = {
    nameOnCard: '',
    cardNumber: '',
    expMonth: 1,
    expYear: new Date().getFullYear() + 1
  };

  constructor(
    private auth: AuthService,
    private cart: CartService,
    private courses: CourseService,
    private enrollments: EnrollmentService,
    private coupons: CouponService,
    private payments: PaymentService,
    private commerce: CommerceEventsService,
    private currency: CurrencyService,
    private toast: ToastService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const user = this.auth.getCurrentUser();
    this.email = user?.email || '';
    await this.load();
  }

  private async load(): Promise<void> {
    const raw: CartItem[] = await this.cart.getItems();
    const courseRecords = await Promise.all(raw.map((i) => this.courses.getById(i.courseId)));
    const enrollments = this.email ? await this.enrollments.listByEmail() : [];
    this.items = raw.map((i, index) => {
      const course = courseRecords[index];
      const isEnrolled = enrollments.some((e) => String(e.courseId) === String(i.courseId));
      return {
        courseId: i.courseId,
        course,
        addedAtIso: i.addedAtIso,
        isEnrolled
      };
    });
  }

  get subtotalCents(): number {
    return this.items
      .filter((i) => !i.isEnrolled)
      .reduce((sum, i) => sum + (i.course?.isFree ? 0 : (i.course?.priceCents || 0)), 0);
  }

  get hasPaidItems(): boolean {
    return this.items.some((i) => !i.isEnrolled && !!i.course && !i.course.isFree && (i.course.priceCents || 0) > 0);
  }

  formatMoney(cents: number, currency = 'USD'): string {
    return this.currency.formatMoney(cents, currency);
  }

  async remove(courseId: string): Promise<void> {
    await this.cart.remove(courseId);
    this.toast.success('Removed from cart');
    await this.load();
  }

  goToCourse(courseId: string): void {
    this.router.navigate(['/courses', courseId]);
  }

  login(): void {
    this.router.navigate(['/login']);
  }

  async openCheckout(): Promise<void> {
    if (!this.isLoggedIn || !this.email) {
      this.toast.info('Login required', 'Login to checkout');
      this.login();
      return;
    }

    if (this.items.length === 0) {
      this.toast.info('Cart is empty');
      return;
    }

    const lines: CheckoutLine[] = this.items.map((i) => {
      const title = i.course?.title || `Course #${i.courseId}`;
      const currency = (i.course?.currency || 'USD').toUpperCase();
      const base = i.course?.isFree ? 0 : (i.course?.priceCents || 0);
      return {
        courseId: i.courseId,
        title,
        currency,
        basePriceCents: base,
        finalPriceCents: base,
        isFree: !!i.course?.isFree || base <= 0,
        isEnrolled: i.isEnrolled,
        couponCode: ''
      };
    });

    this.checkoutLines = lines;
    this.methods = await this.payments.listMethods();
    this.selectedMethodId = this.methods[0]?.id || '';
    this.useNewCard = this.methods.length === 0;
    this.checkoutOpen = true;
  }

  closeCheckout(): void {
    if (this.isProcessing) return;
    this.checkoutOpen = false;
  }

  async applyCoupon(line: CheckoutLine): Promise<void> {
    if (!this.email) return;
    const code = String(line.couponCode || '').trim().toUpperCase();
    line.coupon = undefined;
    line.couponError = undefined;
    line.finalPriceCents = line.basePriceCents;

    if (!code) return;
    if (line.isFree || line.basePriceCents <= 0) {
      line.couponError = 'Coupons are not applicable for free courses';
      return;
    }

    const res = await this.coupons.validateForUser(code, line.courseId, this.email);
    if (!res.ok || !res.coupon) {
      line.couponError = res.error || 'Invalid coupon';
      return;
    }

    line.coupon = res.coupon;
    line.finalPriceCents = this.applyDiscount(line.basePriceCents, res.coupon);
  }

  private applyDiscount(basePriceCents: number, coupon: Coupon): number {
    const base = Math.max(0, Math.floor(basePriceCents || 0));
    if (coupon.discountType === 'percent') {
      const pct = Math.max(0, Math.min(100, Number(coupon.value) || 0));
      return Math.max(0, Math.floor(base * (1 - pct / 100)));
    }
    const amount = Math.max(0, Math.floor((Number(coupon.value) || 0) * 100));
    return Math.max(0, base - amount);
  }

  get totalPayableCents(): number {
    return this.checkoutLines
      .filter((l) => !l.isEnrolled)
      .reduce((sum, l) => sum + (l.isFree ? 0 : (l.finalPriceCents || 0)), 0);
  }

  async confirmCheckout(): Promise<void> {
    if (!this.email) return;
    if (this.isProcessing) return;

    const toBuy = this.checkoutLines.filter((l) => !l.isEnrolled);
    if (toBuy.length === 0) {
      this.toast.info('Nothing to checkout');
      this.checkoutOpen = false;
      return;
    }

    // Re-validate coupons before finalizing.
    for (const line of toBuy) {
      if (line.couponCode) {
        await this.applyCoupon(line);
        if (line.couponError) {
          this.toast.error('Coupon error', `${line.title}: ${line.couponError}`);
          return;
        }
      }
    }

    this.isProcessing = true;
    try {
      let methodId = this.selectedMethodId;
      let ephemeralMethodId: string | null = null;
      const payable = this.totalPayableCents;

      if (payable > 0) {
        if (this.useNewCard) {
          const created = await this.payments.addCardMethod({
            nameOnCard: this.newCard.nameOnCard,
            cardNumber: this.newCard.cardNumber,
            expMonth: Number(this.newCard.expMonth),
            expYear: Number(this.newCard.expYear)
          });
          if (this.saveNewCard) {
            this.methods = await this.payments.listMethods();
          } else {
            // Use it for this checkout, then remove.
            ephemeralMethodId = created.id;
          }
          methodId = created.id;
        }

        if (!methodId) {
          this.toast.error('Payment method required', 'Choose a saved card or add a new one');
          return;
        }
      }

      const paymentCurrency = this.checkoutLines.find((l) => !l.isEnrolled)?.currency || this.currency.resolveDefaultCurrency();

      const paymentId = payable > 0
        ? (await this.payments.createPayment({
            amountCents: payable,
            currency: paymentCurrency,
            methodId,
            description: `Course checkout (${toBuy.length} item${toBuy.length === 1 ? '' : 's'})`,
            metadata: {
              courseIds: toBuy.map((l) => l.courseId).join(',')
            }
          })).id
        : undefined;

      const current = this.auth.getCurrentUser();
      this.commerce.recordCoursePurchase({
        actor: {
          userId: current?.id,
          email: this.email,
          role: (current?.role || 'student') as any,
          name: current?.name
        },
        source: 'cart',
        paymentId,
        paymentMethodId: payable > 0 ? methodId : undefined,
        amountCents: payable,
        currency: paymentCurrency,
        items: toBuy.map((l) => ({
          courseId: String(l.courseId),
          title: l.title,
          basePriceCents: l.basePriceCents,
          finalPriceCents: l.isFree ? 0 : (l.finalPriceCents || 0),
          currency: (l.currency || 'USD').toUpperCase(),
          couponCode: l.coupon ? l.coupon.code : undefined
        })),
        metadata: {
          itemCount: String(toBuy.length)
        }
      });

      for (const line of toBuy) {
        const amount = line.isFree ? 0 : (line.finalPriceCents || 0);
        const couponCode = line.coupon ? line.coupon.code : undefined;
        await this.enrollments.enroll({ courseId: line.courseId });
        if (couponCode) {
          await this.coupons.redeem(couponCode);
        }
      }

      // Remove all processed items from cart (including already-enrolled ones).
      for (const line of this.checkoutLines) {
        await this.cart.remove(line.courseId);
      }

      if (ephemeralMethodId) {
        await this.payments.removeMethod(ephemeralMethodId);
      }

      this.toast.success('Checkout complete', `${toBuy.length} course${toBuy.length === 1 ? '' : 's'} enrolled`);
      this.checkoutOpen = false;
      await this.load();
      this.router.navigate(['/enrolled-courses']);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Checkout failed';
      this.toast.error('Checkout failed', msg);
    } finally {
      this.isProcessing = false;
    }
  }
}
