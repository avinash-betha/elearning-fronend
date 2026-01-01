import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CourseService } from '../../services/course.service';
import { EnrollmentService } from '../../services/enrollment.service';
import { CourseRatingsService } from '../../services/course-ratings.service';
import { CurrencyService } from '../../services/currency.service';

interface CourseCard {
  id: string;
  title: string;
  instructor: string;
  category: string;
  description: string;
  rating: number;
  ratingCount: number;
  students: number;
  price: string;
  isFree: boolean;
}

@Component({
  selector: 'app-courses',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './courses.html',
  styleUrls: ['./courses.css']
})
export class Courses implements OnInit {
  activeFilter = 'All';

  showAll = false;
  courses: CourseCard[] = [];
  filteredCourses: CourseCard[] = [];

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private enrollments: EnrollmentService,
    private ratings: CourseRatingsService,
    private currency: CurrencyService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadCourses();
    const all = this.route.snapshot.queryParamMap.get('all');
    this.showAll = all === '1' || all === 'true';

    const category = this.route.snapshot.queryParamMap.get('category');
    if (category) this.filterCourses(category);
  }

  get hasMore(): boolean {
    return this.filteredCourses.length > 4;
  }

  get visibleCourses(): typeof this.filteredCourses {
    return this.showAll ? this.filteredCourses : this.filteredCourses.slice(0, 4);
  }

  private async loadCourses(): Promise<void> {
    const all = (await this.courseService.listAllCourses())
      .filter((c) => c.status === 'approved' || c.status === 'published');

    this.courses = await Promise.all(all.map(async (c) => {
      const summary = await this.ratings.getSummary(String(c.id));
      const isFree = !!c.isFree || (c.priceCents || 0) <= 0;
      const price = isFree ? 'Free' : this.currency.formatMoney(c.priceCents || 0, c.currency || this.currency.resolveDefaultCurrency());

      return {
        id: String(c.id),
        title: c.title,
        instructor: c.instructorName || 'Instructor',
        category: c.category || 'General',
        description: c.description || 'Course details coming soon.',
        rating: summary.average,
        ratingCount: summary.count,
        students: 0,
        price,
        isFree
      };
    }));

    this.filteredCourses = this.courses;
  }

  filterCourses(category: string) {
    this.activeFilter = category;
    if (category === 'All') {
      this.filteredCourses = this.courses;
    } else {
      this.filteredCourses = this.courses.filter(course => course.category === category);
    }
  }
}
