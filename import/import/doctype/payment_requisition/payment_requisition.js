frappe.ui.form.on('Payment Requisition', {
    refresh: function(frm) {
        // Add "Get Pickup Request" button - only if document is draft
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Get Pickup Request'), function() {
                show_pickup_request_dialog(frm);
            }).addClass('btn-primary');
        }
        if (
            frm.doc.workflow_state == "Create Bill Of Entry" &&
            frm.doc.docstatus == 0 &&
            frm.doc.bill_of_entry_created !== 1
        ) {
            frm.add_custom_button(__('Bill Of Entry'), () => {
                frappe.call({
                    method: "import.import.doctype.boe.boe.create_boe",
                    args: {
                        payment_requisition: frm.doc.name
                    },
                    callback: function (r) {
                        if (!r.exc) {
                            frappe.set_route('Form', 'BOE', r.message); // redirect to BOE
                        }
                    }
                });
            }, __('Create'));
        }
        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: {
                    amount: frm.doc.duty_amount
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }
    },

    pickup_request: function(frm) {
        // When pickup request is manually changed, fetch details
        if (frm.doc.pickup_request) {
            fetch_pickup_request_details(frm, frm.doc.pickup_request);
        }
    },
    
    duty_amount: function(frm) {
        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: {
                    amount: frm.doc.duty_amount
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }
    },

    onload: function(frm) {
        if (!frm.doc.posting_date) {
            frm.set_value("posting_date", frappe.datetime.get_today());
        }
    }
});

function show_pickup_request_dialog(frm) {
    // Create dialog to show available pickup requests
    let d = new frappe.ui.Dialog({
        title: __('Select Pickup Request'),
        fields: [
            {
                fieldname: 'search_filter',
                fieldtype: 'Data',
                label: __('Search'),
                placeholder: __('Type to search...'),
                onchange: function() {
                    filter_table(this.value);
                }
            },
            {
                fieldname: 'pickup_request_html',
                fieldtype: 'HTML'
            },
            {
                fieldname: 'selected_pickup_request',
                fieldtype: 'Data',
                hidden: 1
            }
        ],
        size: 'extra-large',
        primary_action_label: __('Fetch Details'),
        primary_action: function() {
            let selected = d.get_value('selected_pickup_request');
            if (selected) {
                frappe.call({
                    method: 'import.import.doctype.payment_requisition.payment_requisition.validate_pickup_request',
                    args: { pickup_request: selected },
                    callback: function(r) {
                        if (r.message && r.message.exists) {
                            frappe.msgprint({
                                title: __('Already Exists'),
                                message: __('Payment Requisition {0} already exists for this Pickup Request', 
                                    ['<a href="/app/payment-requisition/' + r.message.payment_requisition + '">' + 
                                    r.message.payment_requisition + '</a>']),
                                indicator: 'orange'
                            });
                        } else {
                            fetch_pickup_request_details(frm, selected);
                            d.hide();
                        }
                    }
                });
            } else {
                frappe.msgprint(__('Please select a Pickup Request'));
            }
        }
    });

    // Fetch available pickup requests
    frappe.call({
        method: 'import.import.doctype.payment_requisition.payment_requisition.get_available_pickup_requests',
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                render_pickup_requests(d, r.message);
            } else {
                d.fields_dict.pickup_request_html.$wrapper.html(
                    '<div class="text-center text-muted" style="padding: 50px;">' +
                    '<i class="fa fa-inbox fa-3x"></i><br><br>' +
                    '<h4>No Pickup Requests Available</h4>' +
                    '<p>All pickup requests have been processed or none are submitted yet.</p>' +
                    '</div>'
                );
            }
        }
    });

    d.show();
}

function render_pickup_requests(dialog, data) {
    let html = `
        <style>
            .pickup-request-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
                font-size: 13px;
            }
            .pickup-request-table th {
                background-color: #f8f9fa;
                padding: 12px 8px;
                text-align: left;
                border: 1px solid #dee2e6;
                font-weight: 600;
                position: sticky;
                top: 0;
                z-index: 10;
            }
            .pickup-request-table td {
                padding: 10px 8px;
                border: 1px solid #dee2e6;
            }
            .pickup-request-table tbody tr:hover {
                background-color: #f1f3f5;
                cursor: pointer;
            }
            .pickup-request-table tr.selected {
                background-color: #e7f5ff;
            }
            .table-wrapper {
                max-height: 400px;
                overflow-y: auto;
            }
            .pr-link {
                color: #2490ef;
                font-weight: 500;
            }
        </style>
        <div class="table-wrapper">
            <table class="pickup-request-table" id="pr-table">
                <thead>
                    <tr>
                        <th width="50">Select</th>
                        <th>Pickup Request</th>
                        <th>PO Date</th>
                        <th>Company</th>
                        <th>Incoterm</th>
                        <th>Mode of Shipment</th>
                        <th>Origin</th>
                        <th class="text-right">Grand Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(row => {
        html += `
            <tr data-name="${row.name}" data-searchable="${(row.name + ' ' + (row.company || '') + ' ' + (row.incoterm || '')).toLowerCase()}">
                <td class="text-center">
                    <input type="radio" name="pickup_request_radio" value="${row.name}">
                </td>
                <td><span class="pr-link">${row.name}</span></td>
                <td>${frappe.datetime.str_to_user(row.po_date) || '-'}</td>
                <td>${row.company || '-'}</td>
                <td>${row.incoterm || '-'}</td>
                <td>${row.mode_of_shipment || '-'}</td>
                <td>${row.country_origin || '-'}</td>
                <td class="text-right">${format_currency(row.grand_total || 0, row.currency)}</td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    dialog.fields_dict.pickup_request_html.$wrapper.html(html);

    // Add click handlers
    dialog.$wrapper.find('.pickup-request-table tbody tr').on('click', function() {
        let name = $(this).data('name');
        $(this).find('input[type="radio"]').prop('checked', true);
        $(this).addClass('selected').siblings().removeClass('selected');
        dialog.set_value('selected_pickup_request', name);
    });

    // Filtering
    window.filter_table = function(search_text) {
        let $rows = dialog.$wrapper.find('.pickup-request-table tbody tr');
        search_text = (search_text || '').toLowerCase();

        $rows.each(function() {
            let searchable = $(this).data('searchable');
            $(this).toggle(!search_text || searchable.includes(search_text));
        });
    };
}

function fetch_pickup_request_details(frm, pickup_request_name) {
    frappe.call({
        method: 'import.import.doctype.payment_requisition.payment_requisition.get_pickup_request_details',
        args: { pickup_request: pickup_request_name },
        freeze: true,
        freeze_message: __('Fetching Pickup Request details...'),
        callback: function(r) {
            if (r.message) {
                let pr = r.message;

                frm.set_value('pickup_request', pr.name);
                frm.set_value('mode_of_shipment', pr.mode_of_shipment);
                frm.set_value('origin', pr.country_origin);
                frm.set_value('posting_date', frappe.datetime.get_today());
                frm.set_value('company', pr.company);



                // Clear and add POs
                frm.clear_table('po_wono');
                if (pr.po_list && pr.po_list.length > 0) {
                    pr.po_list.forEach(function(po) {
                        let row = frm.add_child('po_wono');
                        row.purchase_order = po.purchase_order;
                    });
                }
                frm.refresh_field('po_wono');

                frm.set_value('supplier_name', pr.supplier_name);
                // frm.set_value('supplier', pr.supplier);

                if (pr.po_date) frm.set_value('po_wo_date', pr.po_date);

                frappe.show_alert({
                    message: __('Pickup Request details fetched successfully'),
                    indicator: 'green'
                }, 5);

                frm.refresh();
            }
        }
    });
}


// frappe.ui.form.on('BOE', {
//     refresh: function(frm) {
//         populate_po_in_child(frm);

//         // Auto-add first BOE Entries row if conditions are met
//         if (frm.doc.boe_entries.length === 0 && !frm.doc.pre_alert && frm.doc.po_no?.length && !frm.is_new()) {
//             let row = frm.add_child('boe_entries');
            
//             // Set first PO from Table MultiSelect
//             frappe.model.set_value(row.doctype, row.name, 'po_number', frm.doc.po_no[0].purchase_order);
//             frm.refresh_field('boe_entries');
//         }
//     },
    
//     po_no: function(frm) {
//         populate_po_in_child(frm);
//     },
    
//     pre_alert: function(frm) {
//         populate_po_in_child(frm);
//     }
// });

// frappe.ui.form.on('BOE Entries', {
//     boe_entries_add: function(frm, cdt, cdn) {
//         let row = locals[cdt][cdn];
//         if (!frm.doc.pre_alert && frm.doc.po_no?.length) {
//             frappe.model.set_value(cdt, cdn, 'po_number', frm.doc.po_no[0].purchase_order);
//         }
//     }
// });
// frappe.ui.form.on('BOE', {
//     refresh(frm) {
//         populate_po_in_child(frm);
//     },
//     po_no(frm) {
//         populate_po_in_child(frm);
//     },
//     pre_alert(frm) {
//         populate_po_in_child(frm);
//     }
// });

// function populate_po_in_child(frm) {
//     if (!frm.doc.pre_alert && frm.doc.po_no?.length) {
//         // Clear existing rows to prevent duplicates
//         frm.clear_table('boe_entries');

//         // Add one row per PO
//         frm.doc.po_no.forEach(po_row => {
//             let row = frm.add_child('boe_entries', {
//                 po_number: po_row.purchase_order
//             });
//         });

//         frm.refresh_field('boe_entries');
//     }
// }
