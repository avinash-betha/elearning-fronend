import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CertificateRecord, CertificateService } from '../../services/certificate.service';

@Component({
  selector: 'app-verify-certificate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-certificate.html',
  styleUrls: ['./verify-certificate.css']
})
export class VerifyCertificatePage implements OnInit {
  inputId = '';
  certificate: CertificateRecord | null = null;
  error = '';

  constructor(private route: ActivatedRoute, private certificates: CertificateService) {}

  async ngOnInit(): Promise<void> {
    const id = String(this.route.snapshot.paramMap.get('id') || '').trim();
    if (id) {
      this.inputId = id;
      await this.lookup();
    }
  }

  async lookup(): Promise<void> {
    this.error = '';
    const id = String(this.inputId || '').trim();
    if (!id) {
      this.error = 'Enter a certificate ID to verify.';
      this.certificate = null;
      return;
    }
    const found = await this.certificates.getById(id);
    if (!found) {
      this.error = 'Certificate not found.';
      this.certificate = null;
      return;
    }
    this.certificate = found;
  }
}
