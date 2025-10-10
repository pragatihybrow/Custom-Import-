// Copyright (c) 2025, Pragati Dike and contributors
// For license information, please see license.txt

frappe.ui.form.on('Pickup Request', {
    refresh: function(frm) {
    if (frm.doc.docstatus == 1) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Request for Quotation',
                filters: {
                    'custom_pickup_request': frm.doc.name
                },
                fields: ['name']
            },
            callback: function (r) {
                if (r.message && r.message.length > 0) {
                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Supplier Quotation",
                            filters: {
                                custom_pickup_request: frm.doc.name,
                                docstatus: 1
                            },
                            fields: ['supplier']
                        },
                        callback: function (response) {
                            frm.add_custom_button("Pre Alert", function () {
                                // Check if supplier data is missing or empty
                                if (!response.message || response.message.length === 0 || !response.message[0]['supplier']) {
                                    frappe.msgprint({
                                        title: __('Error'),
                                        indicator: 'red',
                                        message: __('No Supplier Quotation found for this RFQ and Pickup Request. Please create a Supplier Quotation first.')
                                    });
                                    return;
                                }
                                
                                // Fetch pickup request details using server method
                                frappe.call({
                                    method: "import.import.doctype.pre_alert.pre_alert.get_pickup_request_details",
                                    args: { pickup_request: frm.doc.name },
                                    callback: function(pr_data) {
                                        if (pr_data.message) {
                                            let pr = pr_data.message;
                                            
                                            // Create new Pre Alert
                                            frappe.model.with_doctype('Pre Alert', function() {
                                                let pre_alert = frappe.model.get_new_doc('Pre Alert');
                                                
                                                // Set vendor and other parent fields
                                                pre_alert.vendor = response.message[0]['supplier'];
                                                pre_alert.currency = pr.currency || 'INR';
                                                pre_alert.exch_rate = pr.conversion_rate || 1;
                                                pre_alert.total_doc_val = pr.total_doc_val || 0;
                                                pre_alert.total_inr_val = pr.total_inr_val || 0;
                                                
                                                // Add Pickup Request to child table
                                                let pickup_row = frappe.model.add_child(pre_alert, 'Pickup Request CT', 'pickup_request');
                                                pickup_row.pickup_request = frm.doc.name;
                                                
                                                // Add RFQ to child table
                                                if (r.message[0]['name']) {
                                                    let rfq_row = frappe.model.add_child(pre_alert, 'Request For Quotation CT', 'rfq_number');
                                                    rfq_row.request_for_quotation = r.message[0]['name'];
                                                }
                                                
                                                // Add items to Pre Alert item_details child table
                                                if (pr.items && pr.items.length > 0) {
                                                    pr.items.forEach(function(item) {
                                                        let item_row = frappe.model.add_child(pre_alert, 'Pre-Alert Item Details', 'item_details');
                                                        
                                                        item_row.item_code = item.item;
                                                        item_row.item_name = item.material;
                                                        item_row.description = item.material_desc;
                                                        item_row.po_no = item.po_number;
                                                        item_row.quantity = item.pick_qty;
                                                        item_row.item_price = item.rate;
                                                        item_row.amount = item.amount;
                                                        item_row.total_inr_value = item.amount_in_inr;
                                                    });
                                                }
                                                
                                                // Navigate to the form
                                                frappe.set_route('Form', 'Pre Alert', pre_alert.name);
                                            });
                                        }
                                    }
                                });
                            }, ("Create"));
                        }
                    })
                }
            }
        })
    }

        if (frm.doc.docstatus == 1) {
            frm.add_custom_button('Create RFQ', () => {
                show_supplier_popup(frm);
            });
        }

        frm.set_query('supplier_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.name_of_supplier
                }
            };
        });
        
        frm.set_query('billing_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Company',
                    link_name: doc.company
                }
            };
        });
        
        frm.set_query('pickup_address_display', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.name_of_supplier
                }
            };
        });
        
        frm.set_query('name_of_supplier', function () {
            return {
                filters: {
                    'supplier_group': ['!=', "CHA"]
                }
            }
        });

// frm.add_custom_button("Purchase Order", function () {
//     let d = new frappe.ui.form.MultiSelectDialog({
//         doctype: "Purchase Order",
//         target: this.cur_frm,
//         setters: {
//             // transaction_date: null,
//             // supplier: frm.doc.name_of_supplier,
//             // custom_purchase_type: "Import", 
//             custom_port_of_destination_pod : frm.doc.custom_port_of_destination_pod,
//             custom_port_of_loading_pol : frm.doc.custom_port_of_loading_pol
//         },
//         add_filters_group: 1,
//         date_field: 'transaction_date',
//         columns: ['name', 'transaction_date', 'supplier', 'custom_purchase_sub_type'],
//         get_query() {
//             return {
//                 filters: {
//                     docstatus: ['!=', 2],
//                     custom_purchase_sub_type: 'Import',
//                     custom_pickup_status: ['!=', 'Fully Picked']
//                 }
//             };
//         },
// action: async function (selections) {
//     d.dialog.hide();

//     let suppliers_set = new Set((frm.doc.name_of_supplier || []).map(row => row.supplier));
//     let existing_po_set = new Set((frm.doc.po_no || []).map(row => row.purchase_order));
//     let existing_po_list_set = new Set((frm.doc.purchase_order_list || []).map(row => row.po_number));

//     for (const po_name of selections) {
//         await frappe.call({
//             method: "import.import.doctype.pickup_request.pickup_request.get_po_all_details",
//             args: { po_name },
//             callback: function (r) {
//                 if (!r.message) return;

//                 let po_id = r.message.name;
//                 let supplier_id = r.message.supplier;

//                 // ✅ Validate port_of_loading_pol
//                 if (frm.doc.port_of_loading_pol && frm.doc.port_of_loading_pol !== r.message.custom_port_of_loading_pol) {
//                     frappe.msgprint({
//                         title: "Port of Loading Mismatch",
//                         message: `Purchase Order ${po_id} has a different Port of Loading (${r.message.custom_port_of_loading_pol}) than the Pickup Request (${frm.doc.port_of_loading_pol}).`,
//                         indicator: "red"
//                     });
//                     return; // ❌ Skip this PO
//                 }

//                 // ✅ Validate port_of_destination_pod
//                 if (frm.doc.port_of_destination_pod && frm.doc.port_of_destination_pod !== r.message.custom_port_of_destination_pod) {
//                     frappe.msgprint({
//                         title: "Port of Destination Mismatch",
//                         message: `Purchase Order ${po_id} has a different Port of Destination (${r.message.custom_port_of_destination_pod}) than the Pickup Request (${frm.doc.port_of_destination_pod}).`,
//                         indicator: "red"
//                     });
//                     return; // ❌ Skip this PO
//                 }

//                 // ✅ Add supplier (no duplicates)
//                 if (!suppliers_set.has(supplier_id)) {
//                     suppliers_set.add(supplier_id);
//                     let supplier_row = frm.add_child("name_of_supplier");
//                     supplier_row.supplier = supplier_id;
//                 }

//                 // ✅ Add PO number (no duplicates)
//                 if (!existing_po_set.has(po_id)) {
//                     existing_po_set.add(po_id);
//                     let po_row = frm.add_child("po_no");
//                     po_row.purchase_order = po_id;
//                 }

//                 // ✅ Add to purchase_order_list (no duplicates)
//                 if (!existing_po_list_set.has(po_id)) {
//                     existing_po_list_set.add(po_id);
//                     let row = frm.add_child("purchase_order_list");
//                     row.po_number = po_id;
//                     row.document_date = r.message.transaction_date;
//                     row.po_type = r.message.custom_purchase_type;
//                     row.vendor = supplier_id;
//                     row.vendor_name = r.message.supplier_name;
//                     row.currency = r.message.currency;
//                     row.company = r.message.company;
//                     row.exchange_rate = r.message.conversion_rate;
//                 }

//                 // ✅ Add PO items
//                 r.message.items.forEach(item => {
//                     let remaining_qty = item.qty - (item.custom_pick_qty || 0);
//                     let item_row = frm.add_child("purchase_order_details");
//                     item_row.item = item.item_code;
//                     item_row.material = item.item_name;
//                     item_row.quantity = item.qty;
//                     item_row.material_desc = item.description;
//                     item_row.pick_qty = remaining_qty,
//                     // item_row.pick_qty = item.qty;
//                     item_row.po_number = item.parent;
//                     item_row.currency = r.message.currency;
//                     item_row.currency_rate = r.message.conversion_rate;
//                     item_row.rate = item.rate;
//                     item_row.amount = item.amount;
//                     item_row.amount_in_inr = item.base_amount;
//                 });

//                 // ✅ Set main form fields (only if not set already)
//                 if (!frm.doc.port_of_loading_pol) {
//                     frm.set_value("port_of_loading_pol", r.message.custom_port_of_loading_pol);
//                 }
//                 if (!frm.doc.port_of_destination_pod) {
//                     frm.set_value("port_of_destination_pod", r.message.custom_port_of_destination_pod);
//                 }
//                 frm.set_value("incoterm", r.message.incoterm);
//                 frm.set_value("taxes_and_charges", r.message.taxes_and_charges);
//                 frm.set_value("tax_category", r.message.tax_category);
//                 frm.set_value("company_address", r.message.billing_address);

//                 frm.refresh_field("purchase_order_list");
//                 frm.refresh_field("purchase_order_details");
//                 frm.refresh_field("name_of_supplier");
//                 frm.refresh_field("po_no");
//             }
//         });
//     }

//     // ✅ Save the document after all selections processed
//     setTimeout(() => {
//         frm.save();
//     }, 500);
// }


//     });
//     d.dialog.show();
// }, __("Get Items"));
//     },
frm.add_custom_button("Purchase Order", function () {
    let d = new frappe.ui.form.MultiSelectDialog({
        doctype: "Purchase Order",
        target: this.cur_frm,
        setters: {
            custom_port_of_destination_pod : frm.doc.custom_port_of_destination_pod,
            custom_port_of_loading_pol : frm.doc.custom_port_of_loading_pol
        },
        add_filters_group: 1,
        date_field: 'transaction_date',
        columns: ['name', 'transaction_date', 'supplier', 'custom_purchase_sub_type'],
        get_query() {
            return {
                filters: {
                    docstatus: ['!=', 2],
                    custom_purchase_sub_type: 'Import',
                    custom_pickup_status: ['!=', 'Fully Picked']
                }
            };
        },
        action: async function (selections) {
            d.dialog.hide();

            let suppliers_set = new Set((frm.doc.name_of_supplier || []).map(row => row.supplier));
            let existing_po_set = new Set((frm.doc.po_no || []).map(row => row.purchase_order));
            let existing_po_list_set = new Set((frm.doc.purchase_order_list || []).map(row => row.po_number));
            
            // ✅ Track currencies from selected POs
            let currencies_set = new Set();
            let po_details_map = new Map();

            // First pass: Collect all PO details and check currencies
            for (const po_name of selections) {
                await frappe.call({
                    method: "import.import.doctype.pickup_request.pickup_request.get_po_all_details",
                    args: { po_name },
                    async: false,
                    callback: function (r) {
                        if (r.message) {
                            po_details_map.set(po_name, r.message);
                            currencies_set.add(r.message.currency);
                        }
                    }
                });
            }

            // ✅ Check if multiple currencies exist
            let has_multiple_currencies = currencies_set.size > 1;
            
            // ✅ Hide/Show currency-related fields based on multiple currencies
            if (has_multiple_currencies) {
                // Hide supplier currency fields
                frm.set_df_property('total', 'hidden', 1);
                frm.set_df_property('grand_total', 'hidden', 1);
                
                // Show INR fields (if they exist)
                if (frm.fields_dict.base_total) {
                    frm.set_df_property('base_total', 'hidden', 0);
                }
                if (frm.fields_dict.base_grand_total) {
                    frm.set_df_property('base_grand_total', 'hidden', 0);
                }
            } else {
                // Show supplier currency fields
                frm.set_df_property('total', 'hidden', 0);
                frm.set_df_property('grand_total', 'hidden', 0);
                
                // Optionally hide base fields if they exist
                if (frm.fields_dict.base_total) {
                    frm.set_df_property('base_total', 'hidden', 0);
                }
                if (frm.fields_dict.base_grand_total) {
                    frm.set_df_property('base_grand_total', 'hidden', 0);
                }
            }

            // Second pass: Process all POs
            for (const po_name of selections) {
                let r_message = po_details_map.get(po_name);
                if (!r_message) continue;

                let po_id = r_message.name;
                let supplier_id = r_message.supplier;

                // ✅ Validate port_of_loading_pol
                if (frm.doc.port_of_loading_pol && frm.doc.port_of_loading_pol !== r_message.custom_port_of_loading_pol) {
                    frappe.msgprint({
                        title: "Port of Loading Mismatch",
                        message: `Purchase Order ${po_id} has a different Port of Loading (${r_message.custom_port_of_loading_pol}) than the Pickup Request (${frm.doc.port_of_loading_pol}).`,
                        indicator: "red"
                    });
                    continue;
                }

                // ✅ Validate port_of_destination_pod
                if (frm.doc.port_of_destination_pod && frm.doc.port_of_destination_pod !== r_message.custom_port_of_destination_pod) {
                    frappe.msgprint({
                        title: "Port of Destination Mismatch",
                        message: `Purchase Order ${po_id} has a different Port of Destination (${r_message.custom_port_of_destination_pod}) than the Pickup Request (${frm.doc.port_of_destination_pod}).`,
                        indicator: "red"
                    });
                    continue;
                }

                // ✅ Add supplier (no duplicates)
                if (!suppliers_set.has(supplier_id)) {
                    suppliers_set.add(supplier_id);
                    let supplier_row = frm.add_child("name_of_supplier");
                    supplier_row.supplier = supplier_id;
                }

                // ✅ Add PO number (no duplicates)
                if (!existing_po_set.has(po_id)) {
                    existing_po_set.add(po_id);
                    let po_row = frm.add_child("po_no");
                    po_row.purchase_order = po_id;
                }

                // ✅ Add to purchase_order_list (no duplicates)
                if (!existing_po_list_set.has(po_id)) {
                    existing_po_list_set.add(po_id);
                    let row = frm.add_child("purchase_order_list");
                    row.po_number = po_id;
                    row.document_date = r_message.transaction_date;
                    row.po_type = r_message.custom_purchase_type;
                    row.vendor = supplier_id;
                    row.vendor_name = r_message.supplier_name;
                    row.currency = r_message.currency;
                    row.company = r_message.company;
                    row.exchange_rate = r_message.conversion_rate;
                }

                // ✅ Add PO items
                r_message.items.forEach(item => {
                    let remaining_qty = item.qty - (item.custom_pick_qty || 0);
                    let item_row = frm.add_child("purchase_order_details");
                    item_row.item = item.item_code;
                    item_row.material = item.item_name;
                    item_row.quantity = item.qty;
                    item_row.material_desc = item.description;
                    item_row.pick_qty = remaining_qty;
                    item_row.po_number = item.parent;
                    item_row.currency = r_message.currency;
                    item_row.currency_rate = r_message.conversion_rate;
                    item_row.rate = item.rate;
                    item_row.amount = item.amount;
                    item_row.amount_in_inr = item.base_amount;
                });

                // ✅ Set main form fields (only if not set already)
                if (!frm.doc.port_of_loading_pol) {
                    frm.set_value("port_of_loading_pol", r_message.custom_port_of_loading_pol);
                }
                if (!frm.doc.port_of_destination_pod) {
                    frm.set_value("port_of_destination_pod", r_message.custom_port_of_destination_pod);
                }
                
                // ✅ Set other fields only if they exist
                if (frm.fields_dict.incoterm) {
                    frm.set_value("incoterm", r_message.incoterm);
                }
                if (frm.fields_dict.taxes_and_charges) {
                    frm.set_value("taxes_and_charges", r_message.taxes_and_charges);
                }
                if (frm.fields_dict.tax_category) {
                    frm.set_value("tax_category", r_message.tax_category);
                }
                if (frm.fields_dict.company_address && r_message.billing_address) {
                    frm.set_value("company_address", r_message.billing_address);
                }

                frm.refresh_field("purchase_order_list");
                frm.refresh_field("purchase_order_details");
                frm.refresh_field("name_of_supplier");
                frm.refresh_field("po_no");
            }
            
            // ✅ Refresh the form to show/hide fields properly
            frm.refresh_fields();

            // ✅ Save the document after all selections processed
            setTimeout(() => {
                frm.save();
            }, 500);
        }
    });
    d.dialog.show();
}, __("Get Items"))
    },
    
    supplier_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_address", "supplier_address_display", false);
    },
    
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    
    supplier_pickup_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_pickup_address", "pickup_address_display", false);
    },
    
    // NEW: Tax calculation events
    taxes_and_charges: function(frm) {
        if (frm.doc.taxes_and_charges) {
            calculate_taxes_and_totals(frm);
        } else {
            clear_tax_calculations(frm);
            calculate_grand_totals(frm);
        }
    },

    tax_category: function(frm) {
        if (frm.doc.tax_category) {
            // Auto-select tax template based on category
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Purchase Taxes and Charges Template",
                    filters: {
                        tax_category: frm.doc.tax_category,
                        disabled: 0
                    },
                    fields: ["name"],
                    limit: 1
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        frm.set_value('taxes_and_charges', r.message[0].name);
                    }
                }
            });
        }
    },

    currency: function(frm) {
        if (frm.doc.currency) {
            frappe.call({
                method: "erpnext.setup.utils.get_exchange_rate",
                args: {
                    from_currency: frm.doc.currency,
                    to_currency: "INR",
                    transaction_date: frm.doc.po_date || frappe.datetime.get_today()
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('conversion_rate', r.message);
                    }
                }
            });
        }
    },

    conversion_rate: function(frm) {
        update_currency_rates(frm);
    },
    
    custom_get_po_items: function (frm) {
        frappe.call({
            "method": "get_items",
            doc: frm.doc,
            args: {
                po: frm.doc.purchase_order_list,
            },
            callback: function (r) {
                frm.refresh();
                calculate_taxes_and_totals(frm);
            }
        });
    },
    
    before_save: function (frm) {
        calculate_taxes_and_totals(frm);
    },
    
    validate: function (frm) {
        let validation_failed = false;
        let promises = [];

        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            promises.push(
                frappe.call({
                    method: "import.import.doctype.pickup_request.pickup_request.validate_po_order_qty_to_pickup_qty",
                    args: {
                        po_no: d.po_number,
                        item_code: d.item
                    }
                }).then(r => {
                    if (r.message) {
                        let qty = r.message[0]['qty'];
                        let received_qty = r.message[0]['received_qty'];
                        let check_qty = qty - received_qty;

                        if (d.pick_qty > check_qty) {
                            validation_failed = true;
                            frappe.msgprint({
                                title: __("Invalid Pickup Quantity"),
                                indicator: "red",
                                message: __(
                                    `You cannot pick up more than the available PO quantity for item ${d.item}. Please check the PO quantity.`
                                )
                            });
                        }
                    }
                })
            );
        });

        return Promise.all(promises).then(() => {
            if (validation_failed) {
                frappe.validated = false;
            }
        });
    },
    
    mode_of_shipment: function (frm) {
        if (frm.doc.mode_of_shipment == "Ocean liner") {
            frm.set_value("type_wise_value", 6000);
        }
        else if (frm.doc.mode_of_shipment == "MOS1-AIR") {
            frm.set_value("type_wise_value", 5000);
        }
    },
    
    // type_wise_value: function (frm) {
    //     var total_weight = 0;
    //     $.each(frm.doc.dimension_calculation || [], function (i, d) {
    //         var weight = ((d.width ? d.width : 1) * (d.length ? d.length : 1) * (d.height ? d.height : 1)) / (frm.doc.type_wise_value ? frm.doc.type_wise_value : 1);
    //         d.weight = weight;
    //         total_weight += d.weight;
    //     });
    //     frm.refresh_field("dimension_calculation");
    //     frm.set_value("chargeable_weight", total_weight);
    // },
    
    get_pos: function (frm) {
        let purchase_order = [];
        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            const isAlreadyInList = purchase_order.some(item => item === d.po_number);
            if (!isAlreadyInList) {
                purchase_order.push(d.po_number);
            }
        });

        purchase_order.forEach(function (obj) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Purchase Order",
                    filters: {
                        name: obj
                    },
                    fields: ["supplier", "currency", "conversion_rate", "transaction_date", "custom_purchase_type", "company"]
                },
                callback: function (r) {
                    let data = r.message;
                    var row = frm.add_child("purchase_order_list");
                    row.po_number = obj;
                    row.document_date = data[0]['transaction_date'];
                    row.vendor = data[0]['supplier'];
                    row.vendor_name = data[0]['supplier'];
                    row.po_type = data[0]['custom_purchase_type'];
                    row.currency = data[0]['currency'];
                    row.company = data[0]['company'];
                    row.exchange_rate = data[0]['conversion_rate'];
                    frm.refresh_field("purchase_order_list");
                }
            });
        });

        $.each(frm.doc.purchase_order_details || [], function (i, d) {
            frappe.call({
                method: "import.import.doctype.pickup_request.pickup_request.get_items_details",
                args: {
                    parent: d.po_number,
                    item_name: d.item
                },
                callback: function (r) {
                    let data = r.message;
                    const parent_date = data[0];
                    const child_date = data[1];

                    d.currency = parent_date[0]['currency'];
                    d.currency_rate = parent_date[0]['conversion_rate'];
                    d.rate = child_date[0]['rate'];
                    d.amount = d.pick_qty * child_date[0]['rate'];
                    d.amount_in_inr = d.amount * parent_date[0]['conversion_rate'];
                    frm.refresh_field("purchase_order_details");
                    
                    // Recalculate taxes after updating items
                    calculate_taxes_and_totals(frm);
                }
            });
        });
    }
});

// Child table events
frappe.ui.form.on('Purchase Order Details', {
    pick_qty: function(frm, cdt, cdn) {
        calculate_taxes_and_totals(frm);
    },
    
    rate: function(frm, cdt, cdn) {
        calculate_taxes_and_totals(frm);
    },
    
    currency_rate: function(frm, cdt, cdn) {
        calculate_taxes_and_totals(frm);
    },
    
    purchase_order_details_remove: function(frm) {
        calculate_taxes_and_totals(frm);
    }
});

frappe.ui.form.on('Purchase Taxes and Charges', {
    rate: function(frm, cdt, cdn) {
        calculate_taxes_and_totals(frm);
    },
    
    tax_amount: function(frm, cdt, cdn) {
        calculate_taxes_and_totals(frm);
    },
    
    purchase_taxes_and_charges_remove: function(frm) {
        calculate_taxes_and_totals(frm);
    }
});

// Tax calculation functions
function calculate_taxes_and_totals(frm) {
    if (!frm.doc.purchase_order_details || frm.doc.purchase_order_details.length === 0) {
        return;
    }

    // Calculate base totals first
    calculate_base_totals(frm);
    
    // Then calculate taxes if tax template is selected
    if (frm.doc.taxes_and_charges) {
        calculate_taxes(frm);
    } else {
        // Clear tax calculations if no template
        clear_tax_calculations(frm);
    }
    
    // Finally calculate grand totals
    calculate_grand_totals(frm);
}

function calculate_base_totals(frm) {
    let total_qty = 0;
    let total_picked_qty = 0;
    let base_total = 0;
    let total = 0;

    frm.doc.purchase_order_details.forEach(item => {
        if (item.quantity) total_qty += item.quantity;
        if (item.pick_qty) total_picked_qty += item.pick_qty;
        
        // Calculate amounts based on picked quantity
        let amount = (item.pick_qty || 0) * (item.rate || 0);
        let base_amount = amount * (item.currency_rate || 1);
        
        // Update item amounts
        frappe.model.set_value(item.doctype, item.name, 'amount', amount);
        frappe.model.set_value(item.doctype, item.name, 'amount_in_inr', base_amount);
        
        total += amount;
        base_total += base_amount;
    });

    frm.set_value('total_quantity', total_qty);
    frm.set_value('total_picked_quantity', total_picked_qty);
    frm.set_value('total', total);
    frm.set_value('base_total', base_total);
}

function calculate_taxes(frm) {
    if (!frm.doc.taxes_and_charges) return;

    frappe.call({
        method: "erpnext.controllers.accounts_controller.get_taxes_and_charges",
        args: {
            "master_doctype": "Purchase Taxes and Charges Template",
            "master_name": frm.doc.taxes_and_charges
        },
        callback: function(r) {
            if (r.message) {
                // Clear existing taxes
                frm.clear_table("purchase_taxes_and_charges");
                
                let base_total = frm.doc.base_total || 0;
                let total = frm.doc.total || 0;
                let cumulative_base_total = base_total;
                let cumulative_total = total;
                
                // Add taxes from template
                r.message.forEach(tax => {
                    let tax_row = frm.add_child("purchase_taxes_and_charges");
                    tax_row.charge_type = tax.charge_type;
                    tax_row.account_head = tax.account_head;
                    tax_row.description = tax.description;
                    tax_row.rate = tax.rate;
                    tax_row.cost_center = tax.cost_center;
                    tax_row.add_deduct_tax = tax.add_deduct_tax;
                    
                    // Calculate tax amount based on charge type
                    let tax_amount = 0;
                    let base_tax_amount = 0;
                    
                    if (tax.charge_type === "On Net Total") {
                        tax_amount = total * (tax.rate / 100);
                        base_tax_amount = base_total * (tax.rate / 100);
                    } else if (tax.charge_type === "On Previous Row Amount") {
                        // Find previous row
                        let prev_row = frm.doc.purchase_taxes_and_charges[frm.doc.purchase_taxes_and_charges.length - 2];
                        if (prev_row) {
                            tax_amount = (prev_row.tax_amount || 0) * (tax.rate / 100);
                            base_tax_amount = (prev_row.base_tax_amount || 0) * (tax.rate / 100);
                        }
                    } else if (tax.charge_type === "On Previous Row Total") {
                        tax_amount = cumulative_total * (tax.rate / 100);
                        base_tax_amount = cumulative_base_total * (tax.rate / 100);
                    } else if (tax.charge_type === "Actual") {
                        tax_amount = tax.tax_amount || 0;
                        base_tax_amount = tax_amount * (frm.doc.conversion_rate || 1);
                    }
                    
                    // Apply add/deduct
                    if (tax.add_deduct_tax === "Deduct") {
                        tax_amount = -tax_amount;
                        base_tax_amount = -base_tax_amount;
                    }
                    
                    tax_row.tax_amount = tax_amount;
                    tax_row.base_tax_amount = base_tax_amount;
                    
                    cumulative_total += tax_amount;
                    cumulative_base_total += base_tax_amount;
                    
                    tax_row.total = cumulative_total;
                    tax_row.base_total = cumulative_base_total;
                });
                
                frm.refresh_field("purchase_taxes_and_charges");
                
                // Calculate tax totals
                calculate_tax_totals(frm);
            }
        }
    });
}

function calculate_tax_totals(frm) {
    let taxes_and_charges_added = 0;
    let base_taxes_and_charges_added = 0;
    
    if (frm.doc.purchase_taxes_and_charges) {
        frm.doc.purchase_taxes_and_charges.forEach(tax => {
            taxes_and_charges_added += (tax.tax_amount || 0);
            base_taxes_and_charges_added += (tax.base_tax_amount || 0);
        });
    }
    
    frm.set_value('taxes_and_charges_added', taxes_and_charges_added);
    frm.set_value('base_taxes_and_charges_added', base_taxes_and_charges_added);
    // frm.set_value('total_taxes_and_charges', taxes_and_charges_added);
    // frm.set_value('base_total_taxes_and_charges', base_taxes_and_charges_added);
}

function calculate_grand_totals(frm) {
    let base_total = frm.doc.base_total || 0;
    let total = frm.doc.total || 0;
    frm.set_value('base_grand_total', base_total + frm.doc.base_taxes_and_charges_added);
    frm.set_value('grand_total', total + frm.doc.taxes_and_charges_added);
}

function clear_tax_calculations(frm) {
    frm.clear_table("purchase_taxes_and_charges");
    frm.set_value('taxes_and_charges_added', 0);
    frm.set_value('base_taxes_and_charges_added', 0);
    // frm.set_value('total_taxes_and_charges', 0);
    // frm.set_value('base_total_taxes_and_charges', 0);
    frm.refresh_field("purchase_taxes_and_charges");
}

function update_currency_rates(frm) {
    if (!frm.doc.purchase_order_details) return;
    
    let promises = [];
    
    frm.doc.purchase_order_details.forEach(item => {
        if (item.currency && item.currency !== "INR") {
            promises.push(
                frappe.call({
                    method: "erpnext.setup.utils.get_exchange_rate",
                    args: {
                        from_currency: item.currency,
                        to_currency: "INR",
                        transaction_date: frm.doc.po_date || frappe.datetime.get_today()
                    },
                    callback: function(r) {
                        if (r.message) {
                            frappe.model.set_value(item.doctype, item.name, "currency_rate", r.message);
                        }
                    }
                })
            );
        }
    });
    
    Promise.all(promises).then(() => {
        calculate_taxes_and_totals(frm);
    });
}


function show_supplier_popup(frm) {
    const d = new frappe.ui.Dialog({
        title: 'Create RFQ - Add Suppliers',
        fields: [
            {
                label: 'Suppliers',
                fieldname: 'supplier_table',
                fieldtype: 'Table',
                reqd: 1,
                options: 'Supplier Child Table',
                fields: [
                    { fieldname: 'supplier', fieldtype: 'Link', options: 'Supplier', label: 'Supplier', reqd: 1, 'in_list_view': 1},
                     { 
                        fieldname: 'required_by', 
                        fieldtype: 'Date', 
                        label: 'Required By', 
                        reqd: 1, 
                        in_list_view: 1
                    }
                ]
            },
            { fieldname: 'email_template', fieldtype: 'Link', options: 'Email Template', label: 'Email Template', reqd: 1 },
        ],
        primary_action_label: 'Submit',
        primary_action: function(values) {
            // Add validation
            if (!values.supplier_table || values.supplier_table.length === 0) {
                frappe.msgprint('Please add at least one supplier');
                return;
            }
            
            // Disable the dialog during processing
            d.disable_primary_action();
            
            // Validate supplier emails before proceeding
            validate_supplier_emails(values.supplier_table, function(validation_result) {
                if (!validation_result.valid) {
                    // Re-enable the dialog
                    d.enable_primary_action();
                    
                    // Show error message with suppliers missing emails
                    frappe.msgprint({
                        title: 'Missing Email Addresses',
                        indicator: 'red',
                        message: `The following suppliers don't have email addresses:<br><br>
                                 <strong>${validation_result.missing_emails.join('<br>')}</strong><br><br>
                                 Please add email addresses to these suppliers before creating the RFQ.`
                    });
                    return;
                }
                
                // If validation passes, proceed with RFQ creation
                frappe.call({
                    method: 'import.import.doctype.pickup_request.pickup_request.create_rfq_from_pickup_request',  
                    args: {
                        pickup_request: frm.doc.name,
                        suppliers: values.supplier_table,
                        email_template: values.email_template,
                    },
                    callback: function(r) {
                        console.log('Response:', r); // Debug log
                        
                        // Re-enable the dialog
                        d.enable_primary_action();
                        
                        // Check if the call was successful
                        if (r && !r.exc && r.message) {
                            frappe.msgprint({
                                title: 'Success',
                                indicator: 'green',
                                message: `RFQ <a href="/app/request-for-quotation/${r.message}" target="_blank">${r.message}</a> created successfully`
                            });
                            d.hide(); // Close the dialog
                            frm.reload_doc(); // Refresh the form
                        } else {
                            // Handle server-side errors
                            let error_message = 'Failed to create RFQ.';
                            if (r.exc) {
                                console.error('Server error:', r.exc);
                                // Try to extract meaningful error message
                                if (typeof r.exc === 'string' && r.exc.includes('ValidationError')) {
                                    error_message = 'Validation error occurred. Please check your data.';
                                } else if (typeof r.exc === 'string' && r.exc.includes('PermissionError')) {
                                    error_message = 'Permission denied. Please check your access rights.';
                                }
                            }
                            
                            frappe.msgprint({
                                title: 'Error',
                                indicator: 'red',
                                message: error_message + ' Please check the server logs for details.'
                            });
                        }
                    },
                    error: function(r) {
                        console.error('AJAX Error:', r); // Debug log
                        
                        // Re-enable the dialog
                        d.enable_primary_action();
                        
                        frappe.msgprint({
                            title: 'Error',
                            indicator: 'red',
                            message: 'Network error occurred while creating the RFQ. Please try again.'
                        });
                    }
                });
            });
        }
    });

    d.show();
}

// Helper function to validate supplier emails
function validate_supplier_emails(suppliers, callback) {
    const supplier_names = suppliers.map(s => s.supplier);
    
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Supplier',
            filters: [['name', 'in', supplier_names]],
            fields: ['name', 'email_id']
        },
        callback: function(r) {
            if (r.message) {
                const missing_emails = [];
                
                r.message.forEach(supplier => {
                    if (!supplier.email_id || supplier.email_id.trim() === '') {
                        missing_emails.push(supplier.name);
                    }
                });
                
                callback({
                    valid: missing_emails.length === 0,
                    missing_emails: missing_emails
                });
            } else {
                callback({
                    valid: false,
                    missing_emails: supplier_names
                });
            }
        },
        error: function() {
            callback({
                valid: false,
                missing_emails: supplier_names
            });
        }
    });
}

// Legacy function - kept for backward compatibility
function calculation_of_amount_and_inr_amount(frm) {
    calculate_taxes_and_totals(frm);
}


frappe.ui.form.on("Pickup Request", {
    refresh(frm) {
        // Only show button if doc is submitted and not already updated
        if (frm.doc.docstatus === 1 && !frm.doc.custom_po_updated) {
            frappe.call({
                method: "import.import.doctype.pickup_request.pickup_request.should_show_update_button",
                args: {
                    pickup_request: frm.doc.name
                },
                callback: function (r) {
                    if (r.message === true) {
                        frm.add_custom_button("Update PO Pickup Qty", function () {
                            frappe.call({
                                method: "import.import.doctype.pickup_request.pickup_request.trigger_pickup_updates",
                                args: {
                                    pickup_request: frm.doc.name
                                },
                                callback: function () {
                                    frappe.msgprint("Purchase Orders updated.");

                                    // Mark Pickup Request as updated
                                    frappe.call({
                                        method: "frappe.client.set_value",
                                        args: {
                                            doctype: "Pickup Request",
                                            name: frm.doc.name,
                                            fieldname: "custom_po_updated",
                                            value: 1
                                        },
                                        callback: function() {
                                            frm.reload_doc();  // Reload to hide button next time
                                        }
                                    });
                                }
                            });
                        });
                    }
                }
            });
        }
    }
});


frappe.ui.form.on('Pickup Request', {
    taxes_and_charges: function(frm) {
        if (frm.doc.taxes_and_charges) {
            // Apply tax template when selected
            frappe.call({
                method: "import.import.doctype.pickup_request.pickup_request.apply_tax_template_to_pickup_request",
                args: {
                    pickup_request_name: frm.doc.name,
                    template_name: frm.doc.taxes_and_charges
                },
                callback: function(r) {
                    if (r.message) {
                        // Update the form with calculated values
                        frm.clear_table("purchase_taxes_and_charges");
                        
                        // Add tax rows to the child table
                        if (r.message.purchase_taxes_and_charges) {
                            r.message.purchase_taxes_and_charges.forEach(function(tax) {
                                let row = frm.add_child("purchase_taxes_and_charges");
                                Object.assign(row, tax);
                            });
                        }
                        
                        // Update totals
                        // frm.set_value("base_total_taxes_and_charges", r.message.base_total_taxes_and_charges);
                        frm.set_value("total_taxes_and_charges", r.message.total_taxes_and_charges);
                        frm.set_value("base_grand_total", r.message.base_grand_total);
                        frm.set_value("grand_total", r.message.grand_total);
                        
                        frm.refresh_fields();
                    }
                }
            });
        } else {
            // Clear taxes when template is removed
            frm.clear_table("purchase_taxes_and_charges");
            // frm.set_value("base_total_taxes_and_charges", 0);
            frm.set_value("total_taxes_and_charges", 0);
            frm.calculate_taxes_and_totals();
            frm.refresh_fields();
        }
    },
    
    
    validate: function(frm) {
        // Ensure taxes are calculated before saving
        if (frm.doc.taxes_and_charges && frm.doc.purchase_taxes_and_charges.length === 0) {
            frappe.call({
                method: "apply_taxes_and_charges_template",
                doc: frm.doc,
                callback: function(r) {
                    frm.refresh_fields();
                }
            });
        }
    }
});

// Handle changes in purchase_taxes_and_charges child table
frappe.ui.form.on('Purchase Taxes and Charges', {
    rate: function(frm, cdt, cdn) {
        calculate_taxes_on_change(frm);
    },
    
    tax_amount: function(frm, cdt, cdn) {
        calculate_taxes_on_change(frm);
    },
    
    purchase_taxes_and_charges_remove: function(frm) {
        calculate_taxes_on_change(frm);
    }
});

function calculate_taxes_on_change(frm) {
    frappe.call({
        method: "calculate_taxes_and_totals",
        doc: frm.doc,
        callback: function(r) {
            frm.refresh_fields();
        }
    });
}

frappe.ui.form.on("Pickup Request", {
    validate: function(frm) {
        if (frm.doc.po_no && frm.doc.po_no.length > 0) {
            let has_taxes = false;

            // Check each linked PO
            frm.doc.po_no.forEach(po_row => {
                frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Purchase Order",
                        name: po_row.purchase_order
                    },
                    async: false,  // ensure we check before saving
                    callback: function(r) {
                        if (r.message && r.message.taxes_and_charges && r.message.taxes.length > 0) {
                            has_taxes = true;

                            // Copy PO tax template into Pickup Request
                            frm.set_value("taxes_and_charges", r.message.taxes_and_charges);

                            frappe.call({
                                method: "apply_taxes_and_charges_template",
                                doc: frm.doc,
                                callback: function() {
                                    frm.refresh_fields();
                                }
                            });
                        }
                    }
                });
            });

            // If no PO has taxes → clear Pickup Request taxes
            if (!has_taxes) {
                frm.set_value("taxes_and_charges", "");
                frm.clear_table("purchase_taxes_and_charges");
                frm.refresh_fields();
                frappe.msgprint("No taxes found in selected Purchase Orders. Taxes removed from Pickup Request.");
            }
        }
    }
});
