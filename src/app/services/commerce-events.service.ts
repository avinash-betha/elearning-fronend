import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export type CommerceEventType = 'COURSE_PURCHASE' | 'SUBSCRIPTION_CHANGE';

export interface CommerceActor {
  userId?: string;
  email: string;
  role: 'student' | 'instructor' | 'admin';
  name?: string;
}

export interface CoursePurchaseLineItem {
  courseId: string;
  title?: string;
  basePriceCents?: number;
  finalPriceCents: number;
  currency: string;
  couponCode?: string;
}

export interface CoursePurchaseEvent {
  id: string;
  type: 'COURSE_PURCHASE';
  atIso: string;
  actor: CommerceActor;
  source: 'cart' | 'course-details';
  paymentId?: string;
  paymentMethodId?: string;
  amountCents: number;
  currency: string;
  items: CoursePurchaseLineItem[];
  metadata?: Record<string, string>;
}

export interface SubscriptionChangeEvent {
  id: string;
  type: 'SUBSCRIPTION_CHANGE';
  atIso: string;
  actor: CommerceActor;
  source: 'profile';
  plan: 'free' | 'monthly' | 'yearly' | 'pro' | 'enterprise';
  status: 'active' | 'inactive';
  organizationName?: string;
  startedAtIso?: string;
  renewsAtIso?: string;
  metadata?: Record<string, string>;
}

export type CommerceEvent = CoursePurchaseEvent | SubscriptionChangeEvent;

const EVENTS_KEY = 'commerce_events_v1';

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class CommerceEventsService {
  constructor(private storage: StorageService) {}

  listAll(): CommerceEvent[] {
    return this.storage.getJson<CommerceEvent[]>(EVENTS_KEY, []);
  }

  recordCoursePurchase(input: Omit<CoursePurchaseEvent, 'id' | 'type' | 'atIso'>): CoursePurchaseEvent {
    const actorEmail = normalizeEmail(input.actor?.email);
    if (!actorEmail) throw new Error('Not logged in');

    const now = new Date().toISOString();
    const event: CoursePurchaseEvent = {
      id: newId('evt'),
      type: 'COURSE_PURCHASE',
      atIso: now,
      actor: {
        ...input.actor,
        email: actorEmail
      },
      source: input.source,
      paymentId: input.paymentId,
      paymentMethodId: input.paymentMethodId,
      amountCents: Math.max(0, Math.floor(input.amountCents || 0)),
      currency: String(input.currency || 'USD').toUpperCase(),
      items: Array.isArray(input.items) ? input.items : [],
      metadata: input.metadata
    };

    const all = this.listAll();
    all.push(event);
    this.storage.setJson(EVENTS_KEY, all);
    return event;
  }

  recordSubscriptionChange(input: Omit<SubscriptionChangeEvent, 'id' | 'type' | 'atIso'>): SubscriptionChangeEvent {
    const actorEmail = normalizeEmail(input.actor?.email);
    if (!actorEmail) throw new Error('Not logged in');

    const now = new Date().toISOString();
    const event: SubscriptionChangeEvent = {
      id: newId('evt'),
      type: 'SUBSCRIPTION_CHANGE',
      atIso: now,
      actor: {
        ...input.actor,
        email: actorEmail
      },
      source: 'profile',
      plan: input.plan,
      status: input.status,
      organizationName: input.organizationName,
      startedAtIso: input.startedAtIso,
      renewsAtIso: input.renewsAtIso,
      metadata: input.metadata
    };

    const all = this.listAll();
    all.push(event);
    this.storage.setJson(EVENTS_KEY, all);
    return event;
  }
}
