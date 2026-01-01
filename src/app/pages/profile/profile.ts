import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, AppUser } from '../../services/auth.service';
import { InstructorApplicationService } from '../../services/instructor-application.service';
import { PaymentMethod, PaymentService } from '../../services/payment.service';
import { SubscriptionRecord, SubscriptionPlan, SubscriptionService } from '../../services/subscription.service';
import { CertificateRecord, CertificateService } from '../../services/certificate.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.html',
  styleUrls: ['./profile.css']
})
export class Profile implements OnInit {
  user: AppUser | null = null;
  isAdmin = false;
  adminProfile = {
    name: '',
    email: ''
  };

  form = {
    name: '',
    email: '',
    profilePhotoDataUrl: ''
  };

  photoPreview = '';

  subscription: SubscriptionRecord | null = null;
  certificates: CertificateRecord[] = [];

  paymentMethods: PaymentMethod[] = [];
  cardForm = {
    nameOnCard: '',
    cardNumber: '',
    expMonth: 1,
    expYear: new Date().getFullYear() + 1
  };

  constructor(
    private auth: AuthService,
    private apps: InstructorApplicationService,
    private subs: SubscriptionService,
    private payments: PaymentService,
    private certificatesService: CertificateService,
    private toast: ToastService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.user = await this.auth.fetchCurrentUser();
    } catch {
      this.user = null;
    }
    if (!this.user) {
      this.user = this.auth.getCurrentUser();
    }
    if (!this.user) {
      const role = localStorage.getItem('userRole');
      if (role === 'admin') {
        this.isAdmin = true;
        this.adminProfile.name = localStorage.getItem('userName') || 'Administrator';
        this.adminProfile.email = localStorage.getItem('userEmail') || 'admin@elearning.com';
      }
      return;
    }

    this.form.name = this.user.name;
    this.form.email = this.user.email;
    this.form.profilePhotoDataUrl = this.user.profilePhotoDataUrl || '';
    this.photoPreview = this.form.profilePhotoDataUrl;

    await this.refreshSubscription();
    await this.refreshPaymentMethods();
    await this.refreshCertificates();
  }

  private async refreshSubscription(): Promise<void> {
    if (!this.user?.email) return;
    this.subscription = await this.subs.get();
  }

  private async refreshPaymentMethods(): Promise<void> {
    if (!this.user?.email) return;
    this.paymentMethods = await this.payments.listMethods();
  }

  private async refreshCertificates(): Promise<void> {
    if (!this.user?.email) return;
    const list = await this.certificatesService.listByEmail();
    this.certificates = list.sort((a, b) => (a.issuedAtIso < b.issuedAtIso ? 1 : -1));
  }

  get instructorStatus(): string {
    return this.user?.instructorApplicationStatus || 'none';
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      this.toast.error('Invalid image', 'Upload JPG, PNG, or WebP');
      input.value = '';
      return;
    }

    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      this.toast.error('Image too large', 'Max size is 3MB');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      this.photoPreview = dataUrl;
      this.form.profilePhotoDataUrl = dataUrl;

      // Persist immediately so the nav + other pages reflect the change without requiring a separate save.
      try {
        const updated = await this.auth.updateCurrentUser({ profilePhotoDataUrl: dataUrl });
        this.user = updated;
        this.toast.success('Photo updated');
      } catch (e: any) {
        this.toast.error('Failed to update photo', e?.message || 'Please try again');
      }
    };
    reader.readAsDataURL(file);
  }

  async save(): Promise<void> {
    try {
      const updated = await this.auth.updateCurrentUser({
        name: this.form.name,
        email: this.form.email,
        profilePhotoDataUrl: this.form.profilePhotoDataUrl
      });
      this.user = updated;
      this.toast.success('Profile updated');

      // Email can change; reload dependent data.
      await this.refreshSubscription();
      await this.refreshPaymentMethods();
      await this.refreshCertificates();
    } catch (e: any) {
      this.toast.error('Failed to update profile', e?.message || 'Please try again');
    }
  }

  get membershipPlanLabel(): string {
    const plan = this.subscription?.plan || 'free';
    if (plan === 'monthly') return 'Monthly membership';
    if (plan === 'yearly') return 'Yearly membership';
    return 'Free';
  }

  get isMember(): boolean {
    return (this.subscription?.plan || 'free') !== 'free';
  }

  async startMembership(plan: Exclude<SubscriptionPlan, 'free'>): Promise<void> {
    if (!this.user?.email) return;

    try {
      const now = new Date();
      const startedAtIso = now.toISOString();
      const renewsAtIso = this.computeRenewsAtIso(now, plan);

      const next = await this.subs.set({
        plan,
        startedAtIso,
        renewsAtIso,
        organizationName: undefined
      });
      this.subscription = next;

      this.toast.success('Membership activated', plan === 'monthly' ? 'Monthly plan' : 'Yearly plan');
    } catch (e: any) {
      this.toast.error('Failed to activate membership', e?.message || 'Please try again');
    }
  }

  async cancelMembership(): Promise<void> {
    if (!this.user?.email) return;

    try {
      await this.subs.cancel();
      this.subscription = await this.subs.get();

      this.toast.success('Membership cancelled');
    } catch (e: any) {
      this.toast.error('Failed to cancel membership', e?.message || 'Please try again');
    }
  }

  private computeRenewsAtIso(now: Date, plan: Exclude<SubscriptionPlan, 'free'>): string {
    const d = new Date(now.getTime());
    if (plan === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d.toISOString();
  }

  async addPaymentMethod(): Promise<void> {
    if (!this.user?.email) return;
    try {
      await this.payments.addCardMethod({
        nameOnCard: this.cardForm.nameOnCard,
        cardNumber: this.cardForm.cardNumber,
        expMonth: Number(this.cardForm.expMonth),
        expYear: Number(this.cardForm.expYear)
      });
      this.toast.success('Payment method added');
      this.cardForm = {
        nameOnCard: '',
        cardNumber: '',
        expMonth: 1,
        expYear: new Date().getFullYear() + 1
      };
      await this.refreshPaymentMethods();
    } catch (e: any) {
      this.toast.error('Failed to add card', e?.message || 'Please try again');
    }
  }

  async removePaymentMethod(methodId: string): Promise<void> {
    if (!this.user?.email) return;
    try {
      await this.payments.removeMethod(methodId);
      this.toast.success('Payment method removed');
      await this.refreshPaymentMethods();
    } catch (e: any) {
      this.toast.error('Failed to remove card', e?.message || 'Please try again');
    }
  }

  copyCertificateId(certId: string): void {
    const id = String(certId || '').trim();
    if (!id) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(id)
        .then(() => this.toast.success('Certificate ID copied'))
        .catch(() => this.toast.info('Copy failed', 'Please copy the ID manually'));
      return;
    }
    this.toast.info('Copy not supported', 'Please copy the ID manually');
  }

  openCertificate(certId: string): void {
    const id = String(certId || '').trim();
    if (!id) return;
    this.router.navigate(['/verify-certificate', id]);
  }

  goToInstructorApplication(): void {
    this.router.navigate(['/apply-instructor']);
  }

  async viewMyApplication(): Promise<void> {
    if (!this.user?.email) return;
    const app = await this.apps.getMine();
    if (!app) {
      this.toast.info('No application found');
      return;
    }
    this.toast.info('Application status', `Status: ${app.status}`);
  }
}
