import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEditSideeffects } from './admin-edit-sideeffects';

describe('AdminEditSideeffects', () => {
  let component: AdminEditSideeffects;
  let fixture: ComponentFixture<AdminEditSideeffects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEditSideeffects]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEditSideeffects);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
