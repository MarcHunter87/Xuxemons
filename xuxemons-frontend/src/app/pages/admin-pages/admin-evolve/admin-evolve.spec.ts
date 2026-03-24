import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AdminEvolve } from './admin-evolve';

describe('AdminEvolve', () => {
  let component: AdminEvolve;
  let fixture: ComponentFixture<AdminEvolve>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEvolve, HttpClientTestingModule],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEvolve);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
