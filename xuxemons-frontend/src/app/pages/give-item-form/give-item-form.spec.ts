import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GiveItemForm } from './give-item-form';

describe('GiveItemForm', () => {
  let component: GiveItemForm;
  let fixture: ComponentFixture<GiveItemForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GiveItemForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GiveItemForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
