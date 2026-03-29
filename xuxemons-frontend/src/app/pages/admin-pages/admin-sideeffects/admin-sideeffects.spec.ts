import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminSideeffects } from './admin-sideeffects';

describe('AdminSideeffects', () => {
  let component: AdminSideeffects;
  let fixture: ComponentFixture<AdminSideeffects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSideeffects]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminSideeffects);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
